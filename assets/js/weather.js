/**
 * Subai Theme - 首页天气磁贴
 *
 * 设计思路（参考映间 MARGIN 首页天气卡的「点阵天空」做法，按本站语境重写）：
 * 1. 天空不是图片，而是一块 6px 步进的点阵：太阳/月亮按当地时间走弧线，
 *    云随风飘、雨雪按帧下落、夜里星星闪烁，地平线用点阵山丘收边；
 * 2. 每一层（太阳、云、雨……）单独一个 <path>，每帧只在 d 变化时才写回，
 *    避免整块 SVG 重建导致的重复解析与重排；
 * 3. 数据来自 Open-Meteo（免密钥、开放 CORS），定位顺序为「手动选择 > 固定坐标 > IP 粗定位 > 兜底城市」，
 *    结果缓存在 localStorage，默认 30 分钟刷新一次；
 * 4. 动画只在磁贴可见、页面在前台、且未开启「减少动态效果」时运行。
 */

(function() {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var CACHE_KEY = 'subai:weather:cache:v1';
  var LOC_KEY = 'subai:weather:loc:v1';

  /* ==========================================================================
     点阵天空
     ========================================================================== */

  var PITCH = 6;          // 每个点占的方框边长
  var DOT = 4.5;          // 点本身边长
  var FRAME_MS = 170;     // 每帧间隔，约 6fps：够看出流动，又不占 CPU
  var SUNRISE = 7.5;      // 日出时刻（小时）
  var SUNSET = 19.5;      // 日落时刻（小时）
  var SYNODIC = 29.530588;
  var NEW_MOON = Date.UTC(2026, 0, 18, 19, 52);

  // 绘制顺序即叠放顺序
  var SKY_LAYERS = [
    'off', 'glow', 'star', 'moonDim', 'moon', 'sun', 'ray', 'bird',
    'snow', 'rain', 'bolt', 'cloud', 'cloudDark', 'fog', 'wind', 'hill', 'horizon'
  ];

  // 每种天空的构成：cover 遮住日/月/星，rain/snow/fog/wind/heat 是量（0–1）
  var SKIES = {
    clear: { birds: 2 },
    partly: { clouds: [[0.2, 0.3, 2], [0.66, 0.46, 3]] },
    cloud: { cover: true, clouds: [[0.04, 0.2, 4], [0.24, 0.36, 5, true], [0.45, 0.22, 4], [0.64, 0.4, 5, true], [0.85, 0.24, 4]] },
    drizzle: { cover: true, rain: 0.32, clouds: [[0.14, 0.22, 4], [0.5, 0.3, 5], [0.82, 0.2, 4]] },
    rain: { cover: true, rain: 0.68, clouds: [[0.1, 0.2, 4, true], [0.42, 0.3, 5, true], [0.76, 0.22, 4, true]] },
    storm: { cover: true, rain: 1, bolt: true, wind: 0.5, clouds: [[0.08, 0.18, 4, true], [0.4, 0.26, 5, true], [0.72, 0.18, 4, true], [0.94, 0.3, 4, true]] },
    snow: { cover: true, snow: 0.85, clouds: [[0.14, 0.2, 4], [0.52, 0.28, 5], [0.84, 0.2, 4]] },
    sleet: { cover: true, rain: 0.4, snow: 0.4, clouds: [[0.16, 0.2, 4, true], [0.56, 0.28, 5], [0.88, 0.22, 3]] },
    mist: { fog: 0.85 },
    windy: { wind: 0.9, clouds: [[0.3, 0.28, 3], [0.72, 0.4, 3]] },
    heat: { heat: 1 }
  };

  var round1 = function(value) {
    return Math.round(value * 10) / 10;
  };

  var moonAge = function(date) {
    var age = (((date.getTime() - NEW_MOON) / 86400000) / SYNODIC) % 1;
    return age < 0 ? age + 1 : age;
  };

  // 月相：被照亮的比例决定明暗交界线落在圆内的哪一侧
  var isMoonLit = function(dx, radius, age) {
    var lit = (1 - Math.cos(age * 2 * Math.PI)) / 2;
    var edge = 1 - 2 * lit;
    return age < 0.5 ? dx / radius >= edge : dx / radius <= -edge;
  };

  /**
   * 画一帧点阵天空。
   * @returns {Object} 层名 → SVG path 的 d 字符串
   */
  function buildSky(cols, rows, hour, kind, tick) {
    var grid = Object.create(null);
    var ground = Math.max(3, rows - 3); // 云与雨的底边，再往下留给山
    var scene = SKIES[kind] || SKIES.cloud;
    var now = ((hour % 24) + 24) % 24;
    var isDay = now >= SUNRISE && now <= SUNSET;
    var covered = !!scene.cover;
    var wind = scene.wind || 0;

    var put = function(x, y, layer) {
      x = Math.round(x);
      y = Math.round(y);
      if (x < 0 || y < 0 || x >= cols || y >= rows) return;
      grid[x + ',' + y] = layer;
    };

    // 日/月的大小跟着天空的高度走：面板又宽又扁时，太大会把整片天占满。
    // 半径取小数，圆盘边缘才会被削圆，而不是长成一个「十」字
    var radius = Math.max(2, Math.min(3.4, rows * 0.16));
    var arcTop = Math.max(2, radius + 1.2); // 弧顶给日/月的半径留位置，别被上边缘切平
    var arcX = function(t) { return 2 + t * (cols - 5); };
    var arcY = function(t) { return ground - 1 - Math.sin(Math.PI * t) * (ground - 1 - arcTop); };

    // 夜里：固定散布的星点，按帧相位闪烁
    if (!isDay && !covered) {
      var starCount = Math.max(6, Math.round(cols * rows / 46));
      for (var s = 0; s < starCount; s++) {
        if ((s * 7 + tick) % 13 === 0) continue;
        put((s * 37 + 11) % cols, (s * 13 + 2) % Math.max(2, ground - 4), 'star');
      }
    }

    // 白天：太阳走弧线，四条光芒隔帧换方向；夜里：月亮按相位只点亮一部分
    if (!covered) {
      if (isDay) {
        var t = (now - SUNRISE) / (SUNSET - SUNRISE);
        var sx = Math.round(arcX(t));
        var sy = Math.round(arcY(t));
        for (var dx = -4; dx <= 4; dx++) {
          for (var dy = -4; dy <= 4; dy++) {
            if (dx * dx + dy * dy <= radius * radius + 0.4) put(sx + dx, sy + dy, 'sun');
          }
        }
        var rays = tick % 4 < 2
          ? [[0, -1], [0, 1], [-1, 0], [1, 0]]
          : [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]];
        for (var r = 0; r < rays.length; r++) {
          for (var k = radius + 1.2; k <= radius + 2.2; k += 1) {
            put(sx + rays[r][0] * k, sy + rays[r][1] * k, 'ray');
          }
        }
        // 晴天的鸟：两三只，慢慢横向移动
        var birds = Math.min(2, Math.round(scene.birds || 0));
        for (var b = 0; b < birds; b++) {
          var bx = (Math.round(cols * 0.5) + b * 6 + Math.floor(tick / 3)) % (cols + 6) - 3;
          var by = 2 + b * 3;
          var flap = tick % 2;
          put(bx - 1, by - flap, 'bird');
          put(bx, by, 'bird');
          put(bx + 1, by - flap, 'bird');
        }
      } else {
        var tn = (((now - SUNSET) + 24) % 24) / (24 - (SUNSET - SUNRISE));
        var mx = Math.round(arcX(tn));
        var my = Math.round(arcY(tn));
        var age = moonAge(new Date());
        for (var mdx = -4; mdx <= 4; mdx++) {
          for (var mdy = -4; mdy <= 4; mdy++) {
            if (mdx * mdx + mdy * mdy > radius * radius + 0.4) continue;
            put(mx + mdx, my + mdy, isMoonLit(mdx, radius, age) ? 'moon' : 'moonDim');
          }
        }
      }
    }

    // 地平线附近的暖光：日出、日落时从地平线向上柔和消退
    if (isDay && !covered) {
      var td = (now - SUNRISE) / (SUNSET - SUNRISE);
      var glowStrength = td < 0.12 ? (1 - td / 0.12) : (td > 0.88 ? (td - 0.88) / 0.12 : 0);
      if (glowStrength > 0.05) {
        for (var gy = ground - 4; gy < ground; gy++) {
          var gyDensity = glowStrength * (1 - (ground - 1 - gy) / 5);
          for (var gx = 0; gx < cols; gx++) {
            // 用伪随机阈值模拟渐变：靠近地平线的行更密，远处更稀
            if (((gx * 7 + gy * 13) % 100) / 100 < gyDensity * 0.7) put(gx, gy, 'glow');
          }
        }
      }
    }

    // 云的位置：随风横向漂移，超出边界后从另一侧回来；竖直方向留出云顶的高度，别把轮廓切平
    // 视差：前景暗云速度 ×1.35，背景亮云 ×0.72，叠出景深
    var drift = tick * (0.18 + wind * 0.8);
    var clouds = (scene.clouds || []).map(function(cloud) {
      var w = Math.max(2, Math.round(cloud[2] * (0.6 + cols / 90)));
      var span = cols + 2 * w + 4;
      var speedFactor = cloud[3] ? 1.35 : 0.72;
      var cx = ((Math.round(cloud[0] * cols + drift * speedFactor) % span) + span) % span - w - 2;
      var cy = Math.max(Math.round(cloud[1] * ground), Math.round(w) + 2);
      return {
        cx: cx,
        cy: Math.min(cy, ground - 1),
        w: w,
        layer: cloud[3] ? 'cloudDark' : 'cloud'
      };
    });

    // 雨：沿着每朵云的下方落，斜度、密度、拖尾长度都跟雨量和风有关
    if (scene.rain) {
      var rain = scene.rain;
      var stepX = rain > 0.7 ? 1 : 2;
      var gap = rain > 0.7 ? 2 : 3;
      var streak = rain > 0.4 ? 2 : 1;
      var slant = rain > 0.7 || wind > 0.4;
      for (var ci = 0; ci < clouds.length; ci++) {
        var c = clouds[ci];
        for (var rx = c.cx - c.w + 1; rx <= c.cx + c.w - 1; rx++) {
          if (((rx % stepX) + stepX) % stepX !== 0) continue;
          // 相位跟列位置绑定，不同列的雨点错开，才不会连成一条横线
          var phase = (rx * 5) % gap;
          for (var ry = c.cy + 3; ry < ground; ry++) {
            if (((ry - tick * 2 + phase) % gap + gap) % gap !== 0) continue;
            for (var tail = 0; tail < streak && ry + tail < ground; tail++) {
              put(rx + (slant ? ((ry + tail) % 2) : 0), ry + tail, 'rain');
            }
          }
        }
      }
    }

    // 雪：稀疏点，左右轻微摇曳
    if (scene.snow) {
      var flakes = Math.max(6, Math.round(scene.snow * Math.min(46, cols)));
      for (var f = 0; f < flakes; f++) {
        var sway = Math.round(Math.sin(tick / 4 + f)) + Math.round(wind * 2);
        put((f * 13 + sway + cols) % cols, (f * 7 + Math.floor(tick / 2)) % ground, 'snow');
      }
    }

    // 雷暴：每 4 秒左右劈一次，从云底折向地面
    if (scene.bolt && clouds.length && tick % 24 < 3) {
      var boltCloud = clouds[1] || clouds[0];
      var boltX = boltCloud.cx;
      for (var by2 = boltCloud.cy + 3, zig = 0; by2 < ground; by2++, zig++) {
        boltX += zig % 6 < 3 ? -1 : 1;
        put(boltX, by2, 'bolt');
        put(boltX + 1, by2, 'bolt');
      }
    }

    // 云体：三个椭圆叠出轮廓（主团 + 左右两个小鼓包），底边压平；整体比宽略扁，才像云
    var puff = function(cx, cy, w, layer) {
      var blobs = [
        [0, 0, w, w * 0.7],
        [-w * 0.5, -w * 0.4, w * 0.5, w * 0.42],
        [w * 0.5, -w * 0.26, w * 0.42, w * 0.34]
      ];
      for (var b = 0; b < blobs.length; b++) {
        var blob = blobs[b];
        var rx = blob[2];
        var ry = blob[3];
        var ox = cx + blob[0];
        var oy = cy + blob[1];
        for (var dx = Math.ceil(-rx); dx <= Math.ceil(rx); dx++) {
          for (var dy = Math.ceil(-ry); dy <= 0; dy++) {
            if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1) put(ox + dx, oy + dy, layer);
          }
        }
      }
      // 平底
      for (var bx = cx - w; bx <= cx + w; bx++) put(bx, cy, layer);
    };
    for (var pi = 0; pi < clouds.length; pi++) {
      puff(clouds[pi].cx, clouds[pi].cy, clouds[pi].w, clouds[pi].layer);
    }

    // 雾：几条横向断带，缓慢平移
    if (scene.fog) {
      var bands = [2, 4, 6].slice(0, Math.max(1, Math.round(scene.fog * 3)));
      for (var bi = 0; bi < bands.length; bi++) {
        var offset = (bi % 2 ? -1 : 1) * Math.floor(tick / 3) + bi * 4;
        for (var fx = 0; fx < cols; fx++) {
          if ((((fx + offset) % 11) + 11) % 11 < 6) put(fx, ground - bands[bi], 'fog');
        }
      }
    }

    // 风：几道短短的风痕，越吹越远
    if (wind > 0.3) {
      var gusts = Math.max(2, Math.round(wind * 6));
      for (var g = 0; g < gusts; g++) {
        var wy = 2 + (g * 5) % Math.max(2, ground - 4);
        var len = 3 + (g % 3);
        var wx = (g * 17 + tick * 2) % (cols + 10) - 5;
        for (var wk = 0; wk < len; wk++) put(wx + wk, wy, 'wind');
        put(wx + len, wy - 1, 'wind');
      }
    }

    // 热浪：贴着地面向上抖
    if (scene.heat) {
      for (var hx = 1; hx < cols; hx += 3) {
        for (var hy = ground - 3; hy < ground; hy++) {
          if ((hy + tick) % 3 === 0) put(hx + ((hy + tick) % 2), hy, 'glow');
        }
      }
    }

    // 山：两座不同高度的丘陵，最后一行压成地平线
    for (var hxx = 0; hxx < cols; hxx++) {
      var height = Math.max(0, Math.round(2 - Math.abs(hxx - cols * 0.78) / 3)) +
        Math.max(0, Math.round(1.4 - Math.abs(hxx - cols * 0.12) / 3.4));
      for (var hy2 = rows - 1 - height; hy2 < rows; hy2++) {
        grid[hxx + ',' + hy2] = hy2 === rows - 1 ? 'horizon' : 'hill';
      }
    }

    // 收尾：把网格折成每个图层一条 path。底格的「off」整幅是静态的，按尺寸缓存一次即可，
    // 每帧只重算被天气覆盖的那些格子，几千个点的循环就省下来了。
    var paths = {};
    for (var li = 0; li < SKY_LAYERS.length; li++) paths[SKY_LAYERS[li]] = '';
    paths.off = offGridPath(cols, rows);
    var offsetHalf = (PITCH - DOT) / 2;
    var cell = 'h' + round1(DOT) + 'v' + round1(DOT) + 'h-' + round1(DOT);
    for (var key in grid) {
      var comma = key.indexOf(',');
      var gx = Number(key.slice(0, comma));
      var gy = Number(key.slice(comma + 1));
      paths[grid[key]] += 'M' + round1(gx * PITCH + offsetHalf) + ' ' + round1(gy * PITCH + offsetHalf) + cell + 'z';
    }
    return paths;
  }

  /** 整幅底格（没有天气覆盖时的那层点阵），按尺寸缓存 */
  var offCache = { cols: 0, rows: 0, d: '' };
  function offGridPath(cols, rows) {
    if (offCache.cols === cols && offCache.rows === rows) return offCache.d;
    var offsetHalf = (PITCH - DOT) / 2;
    var cell = 'h' + round1(DOT) + 'v' + round1(DOT) + 'h-' + round1(DOT);
    var d = '';
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        d += 'M' + round1(x * PITCH + offsetHalf) + ' ' + round1(y * PITCH + offsetHalf) + cell + 'z';
      }
    }
    offCache = { cols: cols, rows: rows, d: d };
    return d;
  }

  /* 7×7 点阵小图标，用于时段与三日预报 */
  var GLYPH_DOTS = {
    sun: ['...S...', '..SSS..', '.SSSSS.', 'SSSSSSS', '.SSSSS.', '..SSS..', '...S...'],
    moon: ['..MMM..', '.MM....', 'MM.....', 'MM.....', 'MM.....', '.MM....', '..MMM..'],
    cloud: ['.......', '...CC..', '..CCCC.', '.CCCCCC', 'CCCCCCC', '.CCCCC.', '.......'],
    partDay: ['..S....', '.SSS...', 'SSSSS..', '..CCCC.', '.CCCCCC', 'CCCCCCC', '.......'],
    partNight: ['..M....', '.MM....', '..CCCC.', '.CCCCCC', 'CCCCCCC', '.CCCCC.', '.......'],
    rain: ['..CCC..', '.CCCCC.', 'CCCCCCC', '.CCCCC.', '.......', '.R.R.R.', 'R.R.R..'],
    drizzle: ['..CCC..', '.CCCCC.', 'CCCCCCC', '.CCCCC.', '.......', '..R.R..', '.R...R.'],
    storm: ['..DDD..', '.DDDDD.', 'DDDDDDD', '...Z...', '..ZZ...', '...Z...', '..Z....'],
    snow: ['..CCC..', '.CCCCC.', 'CCCCCCC', '.CCCCC.', '.......', '.N.N.N.', 'N.N.N..'],
    sleet: ['..DDD..', '.DDDDD.', 'DDDDDDD', '.DDDDD.', '.......', '.N.R.N.', 'R.N.R..'],
    mist: ['FFFF...', '.......', '..FFFF.', '.......', 'FFFF..F', '.......', '.FFFF.F'],
    wind: ['WWWWW..', '.....W.', 'WWWWWW.', '.......', 'WWWWW.W', '.W.....', 'WWWWWW.'],
    heat: ['.SSS...', 'SSSSS..', '.SSS...', '.......', 'S..S..S', '.S..S..', '.......']
  };

  var GLYPH_LAYER_OF = {
    S: 'sun', M: 'moon', C: 'cloud', D: 'cloudDark',
    R: 'rain', Z: 'bolt', N: 'snow', F: 'fog', W: 'wind'
  };

  var GLYPH_LAYERS = ['sun', 'moon', 'cloud', 'cloudDark', 'rain', 'bolt', 'fog', 'snow', 'wind'];

  function glyphKey(kind, hour) {
    var isDay = hour >= SUNRISE && hour <= SUNSET;
    if (kind === 'clear') return isDay ? 'sun' : 'moon';
    if (kind === 'partly') return isDay ? 'partDay' : 'partNight';
    return GLYPH_DOTS[kind] ? kind : 'cloud';
  }

  function glyphSvg(kind, hour) {
    var dots = GLYPH_DOTS[glyphKey(kind, hour)] || GLYPH_DOTS.cloud;
    var paths = {};
    for (var i = 0; i < GLYPH_LAYERS.length; i++) paths[GLYPH_LAYERS[i]] = '';
    for (var y = 0; y < dots.length; y++) {
      for (var x = 0; x < dots[y].length; x++) {
        var layer = GLYPH_LAYER_OF[dots[y].charAt(x)];
        if (layer) paths[layer] += 'M' + round1(x * 3 + 0.3) + ' ' + round1(y * 3 + 0.3) + 'h2.4v2.4h-2.4z';
      }
    }
    var markup = '<svg class="home-weather-glyph" viewBox="0 0 21 21" shape-rendering="crispEdges" aria-hidden="true">';
    for (var j = 0; j < GLYPH_LAYERS.length; j++) {
      if (paths[GLYPH_LAYERS[j]]) markup += '<path class="wxi-' + GLYPH_LAYERS[j] + '" d="' + paths[GLYPH_LAYERS[j]] + '"/>';
    }
    return markup + '</svg>';
  }

  /* ==========================================================================
     天气代码 → 天空种类
     ========================================================================== */

  function describe(code) {
    if (code === 0) return { kind: 'clear', text: '晴' };
    if (code === 1) return { kind: 'partly', text: '晴间多云' };
    if (code === 2) return { kind: 'partly', text: '多云' };
    if (code === 3) return { kind: 'cloud', text: '阴' };
    if (code === 45 || code === 48) return { kind: 'mist', text: '雾' };
    if (code >= 51 && code <= 55) return { kind: 'drizzle', text: '毛毛雨' };
    if (code === 56 || code === 57 || code === 66 || code === 67) return { kind: 'sleet', text: '冻雨' };
    if (code === 61) return { kind: 'rain', text: '小雨' };
    if (code === 63) return { kind: 'rain', text: '中雨' };
    if (code === 65) return { kind: 'rain', text: '大雨' };
    if (code >= 71 && code <= 77) return { kind: 'snow', text: code >= 75 ? '大雪' : '雪' };
    if (code >= 80 && code <= 82) return { kind: 'rain', text: '阵雨' };
    if (code === 85 || code === 86) return { kind: 'snow', text: '阵雪' };
    if (code >= 95) return { kind: 'storm', text: '雷雨' };
    return { kind: 'cloud', text: '多云' };
  }

  var WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  /* ==========================================================================
     定位与取数
     ========================================================================== */

  function readJSON(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null');
    } catch (error) {
      return null;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // 隐私模式下写入失败，忽略即可
    }
  }

  function dropKey(key) {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      // ignore
    }
  }

  /** 带超时的 JSON 请求：第三方接口偶尔卡住，不能让磁贴一直转圈 */
  function fetchJson(url, timeout) {
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = controller ? window.setTimeout(function() { controller.abort(); }, timeout || 8000) : null;
    return fetch(url, controller ? { signal: controller.signal } : undefined)
      .then(function(response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function(data) {
        if (timer) clearTimeout(timer);
        return data;
      })
      .catch(function(error) {
        if (timer) clearTimeout(timer);
        throw error;
      });
  }

  /** 按 IP 粗定位；先问 ipwho.is（中文城市名），失败再问 geojs。两次都挂就交给调用方兜底 */
  function locateByIp() {
    return fetchJson('https://ipwho.is/?lang=zh-CN&fields=success,city,latitude,longitude')
      .then(function(data) {
        if (!data || !data.success || !data.city || typeof data.latitude !== 'number') throw new Error('ipwho miss');
        return { name: data.city, lat: data.latitude, lon: data.longitude };
      })
      .catch(function() {
        return fetchJson('https://get.geojs.io/v1/ip/geo.json').then(function(data) {
          var lat = parseFloat(data && data.latitude);
          var lon = parseFloat(data && data.longitude);
          var name = data && (data.city || data.region);
          if (!name || !isFinite(lat) || !isFinite(lon)) throw new Error('geojs miss');
          return { name: name, lat: lat, lon: lon };
        });
      });
  }

  /** 城市名 → 坐标列表（Open-Meteo 地理编码，中文优先，最多 5 条） */
  function geocode(query, count) {
    var url = 'https://geocoding-api.open-meteo.com/v1/search?count=' + (count || 5) + '&language=zh&name=' + encodeURIComponent(query);
    return fetchJson(url).then(function(data) {
      var hits = (data && data.results) || [];
      return hits.map(function(hit) {
        return {
          name: hit.name,
          lat: hit.latitude,
          lon: hit.longitude,
          region: [hit.admin1, hit.country].filter(Boolean).join(' · '),
          manual: true
        };
      });
    });
  }

  function fetchForecast(loc, unit) {
    var url = 'https://api.open-meteo.com/v1/forecast'
      + '?latitude=' + loc.lat + '&longitude=' + loc.lon
      + '&timezone=auto&forecast_days=4'
      + '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m'
      + '&hourly=temperature_2m,weather_code,precipitation_probability'
      + '&daily=weather_code,temperature_2m_max,temperature_2m_min'
      + (unit === 'fahrenheit' ? '&temperature_unit=fahrenheit&wind_speed_unit=mph' : '');

    return fetchJson(url, 12000).then(function(raw) {
      if (!raw || !raw.current) throw new Error('empty payload');
      return normalize(raw, loc);
    });
  }

  function normalize(raw, loc) {
    var offset = Number(raw.utc_offset_seconds) || 0;
    var nowKey = String(raw.current.time).slice(0, 13); // 当地时间到小时，可直接按字符串比较
    var times = (raw.hourly && raw.hourly.time) || [];
    var start = 0;
    for (var i = 0; i < times.length; i++) {
      if (times[i].slice(0, 13) >= nowKey) {
        start = i;
        break;
      }
    }

    var hours = [];
    var precipProb = (raw.hourly && raw.hourly.precipitation_probability) || [];
    for (var k = 0; k < 4; k++) {
      var index = start + k * 3;
      if (index >= times.length) break;
      var hourOfDay = Number(times[index].slice(11, 13));
      hours.push({
        label: k === 0 ? '现在' : hourOfDay + '时',
        hour: hourOfDay,
        kind: describe(raw.hourly.weather_code[index] || 0).kind,
        temp: raw.hourly.temperature_2m[index],
        precip: (precipProb[index] || 0)
      });
    }

    var days = [];
    var daily = raw.daily || { time: [], weather_code: [], temperature_2m_max: [], temperature_2m_min: [] };
    for (var d = 0; d < Math.min(3, (daily.time || []).length); d++) {
      var label = d === 0 ? '今天' : d === 1 ? '明天' : WEEK[new Date(daily.time[d] + 'T00:00:00Z').getUTCDay()];
      days.push({
        name: label,
        kind: describe(daily.weather_code[d] || 0).kind,
        low: daily.temperature_2m_min[d],
        high: daily.temperature_2m_max[d]
      });
    }

    var current = describe(raw.current.weather_code || 0);
    var rainIndex = Math.min(start, ((raw.hourly && raw.hourly.precipitation_probability) || []).length - 1);

    return {
      place: loc.name || '当前位置',
      temp: raw.current.temperature_2m,
      feels: raw.current.apparent_temperature,
      wind: raw.current.wind_speed_10m,
      rain: rainIndex >= 0 ? (raw.hourly.precipitation_probability[rainIndex] || 0) : 0,
      kind: current.kind,
      condition: current.text,
      offset: offset,
      hours: hours,
      days: days,
      at: Date.now()
    };
  }

  /* ==========================================================================
     磁贴
     ========================================================================== */

  function initHomeWeather() {
    // PJAX 换页后磁贴会重新初始化，先回收上一份的定时器、监听与观察器
    var previous = window.Subai.getState && window.Subai.getState('weatherTeardown');
    if (typeof previous === 'function') previous();

    var root = document.querySelector('[data-home-weather]');
    if (!root || root.dataset.weatherReady === 'true') return;
    root.dataset.weatherReady = 'true';
    root.classList.add('is-loading');

    var cfg = {
      lat: parseFloat(root.dataset.lat) || 0,
      lon: parseFloat(root.dataset.lon) || 0,
      city: (root.dataset.city || '').trim(),
      fallbackCity: (root.dataset.fallbackCity || '').trim() || '上海',
      fallbackLat: parseFloat(root.dataset.fallbackLat) || 31.23,
      fallbackLon: parseFloat(root.dataset.fallbackLon) || 121.47,
      refresh: Math.max(5, parseInt(root.dataset.refresh, 10) || 30) * 60000,
      unit: root.dataset.unit === 'fahrenheit' ? 'fahrenheit' : 'celsius',
      editable: root.dataset.allowChange !== 'false'
    };
    var fixed = cfg.lat !== 0 && cfg.lon !== 0;

    var el = {
      city: root.querySelector('[data-weather-city]'),
      meta: root.querySelector('[data-weather-meta]'),
      clock: root.querySelector('[data-weather-clock]'),
      sky: root.querySelector('[data-weather-sky]'),
      temp: root.querySelector('[data-weather-temp]'),
      cond: root.querySelector('[data-weather-cond]'),
      feels: root.querySelector('[data-weather-feels]'),
      flash: root.querySelector('[data-weather-flash]'),
      hours: root.querySelector('[data-weather-hours]'),
      days: root.querySelector('[data-weather-days]')
    };
    if (!el.sky || !el.hours || !el.days) return;

    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    var layerPaths = {};
    for (var i = 0; i < SKY_LAYERS.length; i++) {
      var path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('class', 'wxs-' + SKY_LAYERS[i]);
      layerPaths[SKY_LAYERS[i]] = path;
      svg.appendChild(path);
    }
    el.sky.appendChild(svg);

    var state = { data: null, place: '', tick: 0, cols: 0, rows: 0, visible: false, fetchedAt: 0 };
    var timers = { frame: null, clock: null, timeouts: [], intervals: [] };
    var disposers = [];

    // 统一登记延时任务：换页时能一次清空，避免回调访问已脱离 DOM 的元素
    var later = function(fn, ms) {
      var id = window.setTimeout(function() {
        timers.timeouts = timers.timeouts.filter(function(item) { return item !== id; });
        fn();
      }, ms);
      timers.timeouts.push(id);
      return id;
    };
    var reduceMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

    var prefersStill = function() {
      return Boolean(reduceMotion && reduceMotion.matches);
    };

    /* ── 天空绘制 ───────────────────────────────────────────── */

    var measure = function() {
      var width = el.sky.clientWidth;
      var height = el.sky.clientHeight;
      if (!width || !height) return false;
      var cols = Math.max(14, Math.round(width / PITCH));
      var rows = Math.max(7, Math.round(height / PITCH));
      if (cols === state.cols && rows === state.rows) return false;
      state.cols = cols;
      state.rows = rows;
      svg.setAttribute('viewBox', '0 0 ' + cols * PITCH + ' ' + rows * PITCH);
      return true;
    };

    var localHour = function() {
      if (!state.data) return new Date().getHours();
      var shifted = new Date(Date.now() + state.data.offset * 1000);
      return shifted.getUTCHours() + shifted.getUTCMinutes() / 60;
    };

    var paint = function() {
      if (!state.data || !state.cols) return;
      var paths = buildSky(state.cols, state.rows, localHour(), state.data.kind, state.tick);
      for (var i = 0; i < SKY_LAYERS.length; i++) {
        var name = SKY_LAYERS[i];
        var next = paths[name] || '';
        if (layerPaths[name].getAttribute('d') !== next) {
          if (next) layerPaths[name].setAttribute('d', next);
          else layerPaths[name].removeAttribute('d');
        }
      }
      // 闪电帧触发天空闪光
      if (state.data.kind === 'storm' && paths.bolt && state.tick % 24 < 3 && state.tick !== lastBoltTick) {
        lastBoltTick = state.tick;
        triggerFlash();
      }
    };

    var clockText = function() {
      var shifted = new Date(Date.now() + state.data.offset * 1000);
      var hh = String(shifted.getUTCHours()).padStart(2, '0');
      var mm = String(shifted.getUTCMinutes()).padStart(2, '0');
      return hh + ':' + mm;
    };

    /* 天空背景色调：随当地时刻微调，黎明偏暖粉、白天偏蓝、黄昏偏橙、深夜偏靛 */
    var applySkyTint = function(skyEl, hour) {
      var tint;
      if (hour >= 5 && hour < 7.5) tint = 'color-mix(in oklab, var(--color-bg-secondary) 88%, #c0705a)';
      else if (hour >= 7.5 && hour < 16.5) tint = 'color-mix(in oklab, var(--color-bg-secondary) 93%, #2a5298)';
      else if (hour >= 16.5 && hour < 19.5) tint = 'color-mix(in oklab, var(--color-bg-secondary) 88%, #b8653e)';
      else tint = 'color-mix(in oklab, var(--color-bg-secondary) 86%, #101d3f)';
      skyEl.style.backgroundColor = tint;
    };

    /* 闪电闪光：在 bolt 帧触发短促白光 */
    var lastBoltTick = -99;
    var triggerFlash = function() {
      if (!el.flash || prefersStill()) return;
      el.flash.classList.add('is-on');
      later(function() { el.flash.classList.remove('is-on'); }, 160);
    };

    var tickClock = function() {
      if (!state.data) return;
      if (el.clock) el.clock.textContent = clockText();
      if (el.sky) applySkyTint(el.sky, localHour());
      if (prefersStill()) paint(); // 关掉动画时，日/月位置仍随时间推进
    };

    var runLoop = function() {
      if (timers.frame) {
        clearInterval(timers.frame);
        timers.frame = null;
      }
      if (prefersStill() || !state.data || !state.visible || document.hidden) return;
      timers.frame = window.setInterval(function() {
        if (!root.isConnected) {
          stopTimers();
          return;
        }
        state.tick += 1;
        paint();
      }, FRAME_MS);
    };

    var stopTimers = function() {
      if (timers.frame) {
        clearInterval(timers.frame);
        timers.frame = null;
      }
      if (timers.clock) {
        clearInterval(timers.clock);
        timers.clock = null;
      }
    };

    // PJAX 换页时把定时器、document 级监听与观察器全部回收，避免逐页累积
    var teardownWeather = function() {
      stopTimers();
      timers.timeouts.forEach(function(id) { window.clearTimeout(id); });
      timers.timeouts = [];
      timers.intervals.forEach(function(id) { window.clearInterval(id); });
      timers.intervals = [];
      disposers.forEach(function(dispose) { dispose(); });
      disposers = [];
    };

    if (window.Subai.setState) window.Subai.setState('weatherTeardown', teardownWeather);

    /* ── 渲染 ──────────────────────────────────────────────── */

    var formatTemp = function(value) {
      return Math.round(value) + '°';
    };

    var renderHours = function(hours) {
      el.hours.textContent = '';
      hours.forEach(function(slot) {
        var li = document.createElement('li');
        var label = document.createElement('span');
        label.className = 'home-weather-hour-label';
        label.textContent = slot.label;

        var icon = document.createElement('span');
        icon.className = 'home-weather-hour-icon';
        icon.innerHTML = glyphSvg(slot.kind, slot.hour);

        var value = document.createElement('b');
        value.textContent = formatTemp(slot.temp);

        // 降水概率微条
        var precipWrap = document.createElement('span');
        precipWrap.className = 'home-weather-hour-precip';
        var precipFill = document.createElement('span');
        precipFill.className = 'home-weather-hour-precip-fill';
        precipFill.style.width = Math.min(100, Math.round(slot.precip)) + '%';
        precipWrap.appendChild(precipFill);

        li.appendChild(label);
        li.appendChild(icon);
        li.appendChild(value);
        li.appendChild(precipWrap);
        li.setAttribute('aria-label', slot.label + ' ' + formatTemp(slot.temp) + (slot.precip > 5 ? '，降水 ' + Math.round(slot.precip) + '%' : ''));
        el.hours.appendChild(li);
      });
    };

    /* 温度 → 色相：-10°=冷蓝(210)、15°=暖橙(42)、35°+=热红(5) */
    var tempHue = function(t) {
      var v = Math.max(-10, Math.min(35, t));
      if (v <= 15) return Math.round(210 + (v + 10) / 25 * (42 - 210));
      return Math.round(42 + (v - 15) / 20 * (5 - 42));
    };
    var tempColor = function(t) {
      return 'hsl(' + tempHue(t) + ', 68%, 55%)';
    };

    var renderDays = function(days, currentTemp) {
      el.days.textContent = '';
      if (!days.length) return;

      var lows = days.map(function(day) { return day.low; }).concat([currentTemp]);
      var highs = days.map(function(day) { return day.high; }).concat([currentTemp]);
      var floor = Math.floor(Math.min.apply(null, lows)) - 1;
      var ceiling = Math.ceil(Math.max.apply(null, highs)) + 1;
      // 温差过大的时候压缩刻度，条形才不会全部贴边
      if (ceiling - floor > 14) ceiling = floor + 14;
      var span = Math.max(1, ceiling - floor);

      days.forEach(function(day, index) {
        var li = document.createElement('li');
        li.dataset.kind = day.kind;

        var name = document.createElement('span');
        name.className = 'home-weather-day-name';
        name.textContent = day.name;

        var icon = document.createElement('span');
        icon.className = 'home-weather-day-icon';
        icon.innerHTML = glyphSvg(day.kind, 12);

        var low = document.createElement('span');
        low.className = 'home-weather-day-low';
        low.textContent = formatTemp(day.low);

        var track = document.createElement('span');
        track.className = 'home-weather-day-track';
        var fill = document.createElement('span');
        fill.className = 'home-weather-day-fill';
        var from = Math.max(0, Math.min(1, (Math.round(day.low) - floor) / span));
        var to = Math.max(0, Math.min(1, (Math.round(day.high) - floor) / span));
        fill.style.left = (from * 100).toFixed(1) + '%';
        fill.style.width = Math.max(6, (to - from) * 100).toFixed(1) + '%';
        // 渐变色跟随实际温度：冷端蓝、暖端橙、热端红
        fill.style.background = 'linear-gradient(to right, ' + tempColor(day.low) + ', ' + tempColor(day.high) + ')';
        track.appendChild(fill);

        var high = document.createElement('span');
        high.className = 'home-weather-day-high';
        high.textContent = formatTemp(day.high);

        li.setAttribute('aria-label', day.name + ' ' + formatTemp(day.low) + ' 到 ' + formatTemp(day.high));
        li.appendChild(name);
        li.appendChild(icon);
        li.appendChild(low);
        li.appendChild(track);
        li.appendChild(high);
        el.days.appendChild(li);
      });
    };

    var render = function(data) {
      var prevKind = state.data && state.data.kind;
      state.data = data;
      state.place = data.place;
      root.classList.add('is-ready');
      root.classList.remove('is-unavailable', 'is-loading');

      // LED 与天气联动
      root.dataset.kind = data.kind;

      // 场景切换过渡：天气类型变了就先淡出，换完再淡入
      if (prevKind && prevKind !== data.kind && el.sky) {
        el.sky.classList.add('is-shifting');
        later(function() {
          el.sky.classList.remove('is-shifting');
        }, 750);
      }

      if (el.city) el.city.textContent = data.place;

      // 温度数字滚动动画
      if (el.temp) {
        var oldTemp = parseFloat(el.temp.textContent) || data.temp;
        el.temp.classList.add('is-updating');
        later(function() {
          el.temp.textContent = formatTemp(data.temp);
          el.temp.classList.remove('is-updating');
        }, 200);
        // 如果差值大，做个简单 count-up
        if (Math.abs(oldTemp - data.temp) >= 3) {
          var steps = 5;
          var stepVal = (data.temp - oldTemp) / steps;
          var stepIdx = 0;
          var countTimer = window.setInterval(function() {
            stepIdx++;
            if (stepIdx >= steps) {
              window.clearInterval(countTimer);
              el.temp.textContent = formatTemp(data.temp);
              return;
            }
            el.temp.textContent = formatTemp(oldTemp + stepVal * stepIdx);
          }, 70);
          timers.intervals.push(countTimer);
        }
      }

      if (el.cond) el.cond.textContent = data.condition;

      // 体感温度
      if (el.feels) {
        el.feels.textContent = '体感 ' + formatTemp(data.feels);
      }

      if (el.meta) {
        el.meta.textContent = '降水 ' + Math.round(data.rain) + '% · 风 ' + Math.round(data.wind) + (cfg.unit === 'fahrenheit' ? ' mph' : ' km/h');
      }
      if (el.sky) {
        el.sky.setAttribute('role', 'img');
        el.sky.setAttribute('aria-label', data.place + '：' + data.condition + '，' + formatTemp(data.temp));
        applySkyTint(el.sky, localHour());
      }
      renderHours(data.hours);
      renderDays(data.days, data.temp);
      tickClock();
      measure();
      paint();
      runLoop();
    };

    var fail = function(message) {
      root.classList.add('is-unavailable');
      root.classList.remove('is-loading');
      if (el.cond) el.cond.textContent = '天气暂时取不到';
      if (el.temp) el.temp.textContent = '--°';
      if (el.feels) el.feels.textContent = '';
      if (el.meta) el.meta.textContent = message || '请稍后再试';
      if (el.city) el.city.textContent = '定位失败';
    };

    /* ── 生效位置 ───────────────────────────────────────────── */

    var resolveLocation = function() {
      var manual = cfg.editable ? readJSON(LOC_KEY) : null;
      if (manual && typeof manual.lat === 'number') return Promise.resolve(manual);
      if (fixed) return Promise.resolve({ name: cfg.city || '当前位置', lat: cfg.lat, lon: cfg.lon });
      return locateByIp()
        .then(function(loc) {
          if (!loc.name) loc.name = '当前位置';
          writeJSON(LOC_KEY, loc);
          return loc;
        })
        .catch(function() {
          return { name: cfg.fallbackCity, lat: cfg.fallbackLat, lon: cfg.fallbackLon };
        });
    };

    var load = function(options) {
      var force = Boolean(options && options.force);
      if (!force) {
        var cached = readJSON(CACHE_KEY);
        if (cached && cached.data && Date.now() - cached.data.at < cfg.refresh) {
          // 缓存里可能换了城市，位置仍以当前位置为准
          render(cached.data);
          state.fetchedAt = Date.now();
          return Promise.resolve();
        }
      }
      return resolveLocation()
        .then(function(loc) { return fetchForecast(loc, cfg.unit); })
        .then(function(data) {
          writeJSON(CACHE_KEY, { data: data });
          state.fetchedAt = Date.now();
          render(data);
        })
        .catch(function(error) {
          if (!state.data) fail('数据源未响应');
          if (window.console && console.warn) console.warn('[subai] weather:', error);
        });
    };

    /* ── 交互：改城市 ──────────────────────────────────────── */

    var commitCity = function(value) {
      var query = (value || '').trim();
      if (!query || query === state.place) return Promise.resolve(false);
      return geocode(query, 1)
        .then(function(results) {
          var loc = results && results[0];
          if (!loc) return false;
          writeJSON(LOC_KEY, loc);
          dropKey(CACHE_KEY);
          return load({ force: true }).then(function() { return true; });
        })
        .catch(function() { return false; });
    };

    if (el.city && cfg.editable) {
      el.city.classList.add('is-editable');
      el.city.setAttribute('title', '点击更换城市，右键恢复自动定位');

      el.city.addEventListener('click', function() {
        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'home-weather-city-input';
        input.value = state.place;
        input.setAttribute('aria-label', '城市名称');
        input.setAttribute('autocomplete', 'off');
        el.city.replaceWith(input);
        input.focus();
        input.select();

        var dropdown = null;
        var debounceTimer = null;
        var settled = false;

        var removeDropdown = function() {
          if (dropdown) { dropdown.remove(); dropdown = null; }
        };

        var showDropdown = function(results) {
          removeDropdown();
          if (!results || results.length === 0) return;
          dropdown = document.createElement('div');
          dropdown.className = 'home-weather-city-dropdown';
          results.forEach(function(r) {
            var btn = document.createElement('button');
            btn.type = 'button';
            var nameSpan = document.createElement('span');
            nameSpan.className = 'dropdown-city';
            nameSpan.textContent = r.name;
            btn.appendChild(nameSpan);
            if (r.region) {
              var regionSpan = document.createElement('span');
              regionSpan.className = 'dropdown-region';
              regionSpan.textContent = r.region;
              btn.appendChild(regionSpan);
            }
            btn.addEventListener('mousedown', function(e) {
              e.preventDefault();
              removeDropdown();
              writeJSON(LOC_KEY, r);
              dropKey(CACHE_KEY);
              input.replaceWith(el.city);
              settled = true;
              load({ force: true });
            });
            dropdown.appendChild(btn);
          });
          var place = input.closest('.home-weather-place');
          if (place) place.appendChild(dropdown);
          else input.parentNode.appendChild(dropdown);
        };

        var finish = function(keep) {
          if (settled) return;
          settled = true;
          if (debounceTimer) { window.clearTimeout(debounceTimer); debounceTimer = null; }
          removeDropdown();
          var next = input.value;
          input.replaceWith(el.city);
          if (keep) {
            commitCity(next).then(function(ok) {
              if (!ok) el.city.classList.add('is-invalid');
              later(function() { el.city.classList.remove('is-invalid'); }, 1200);
            });
          }
        };

        input.addEventListener('input', function() {
          if (debounceTimer) window.clearTimeout(debounceTimer);
          var q = input.value.trim();
          if (q.length < 1) { removeDropdown(); return; }
          debounceTimer = later(function() {
            geocode(q, 5).then(showDropdown).catch(function() {});
          }, 280);
        });

        input.addEventListener('keydown', function(event) {
          event.stopPropagation();
          if (event.key === 'Enter') finish(true);
          if (event.key === 'Escape') { removeDropdown(); finish(false); }
          if (event.key === 'ArrowDown' && dropdown) {
            event.preventDefault();
            var first = dropdown.querySelector('button');
            if (first) first.focus();
          }
        });
        input.addEventListener('blur', function() {
          // 延迟关闭，让下拉按钮的 mousedown 先触发
          later(function() { finish(true); }, 200);
        });
      });

      el.city.addEventListener('contextmenu', function(event) {
        if (!readJSON(LOC_KEY)) return;
        event.preventDefault();
        dropKey(LOC_KEY);
        dropKey(CACHE_KEY);
        load({ force: true });
      });
    }

    /* ── 生命周期 ──────────────────────────────────────────── */

    if ('IntersectionObserver' in window) {
      var intersection = new IntersectionObserver(function(entries) {
        state.visible = entries[0].isIntersecting;
        runLoop();
      }, { threshold: 0.05 });
      intersection.observe(root);
      disposers.push(function() { intersection.disconnect(); });
    } else {
      state.visible = true;
    }

    document.addEventListener('visibilitychange', runLoop);
    disposers.push(function() { document.removeEventListener('visibilitychange', runLoop); });

    if (reduceMotion) {
      var onMotionChange = function() { runLoop(); paint(); };
      if (typeof reduceMotion.addEventListener === 'function') {
        reduceMotion.addEventListener('change', onMotionChange);
        disposers.push(function() { reduceMotion.removeEventListener('change', onMotionChange); });
      } else if (typeof reduceMotion.addListener === 'function') {
        reduceMotion.addListener(onMotionChange);
        disposers.push(function() { reduceMotion.removeListener(onMotionChange); });
      }
    }

    if ('ResizeObserver' in window) {
      var resizer = new ResizeObserver(function() {
        if (measure()) paint();
      });
      resizer.observe(el.sky);
      disposers.push(function() { resizer.disconnect(); });
    }

    load();
    timers.clock = window.setInterval(function() {
      if (!root.isConnected) {
        stopTimers();
        return;
      }
      tickClock();
      if (Date.now() - state.fetchedAt > cfg.refresh) load({ force: true });
    }, 15000);
  }

  window.Subai.register('initHomeWeather', initHomeWeather);
})();
