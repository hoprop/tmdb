(function () {
  'use strict';

  // -----------------------------
  // FIX MIXED CONTENT:
  //  - default loaderLocation -> HTTPS
  //  - upgrade http:// -> https://
  //  - add protocol if missing
  // -----------------------------
  var loaderLocation = (typeof window.loaderLocation !== 'undefined' && window.loaderLocation)
    ? String(window.loaderLocation)
    : 'https://widget1.ottplayer.tv/';

  // normalize
  if (loaderLocation.indexOf('http://') === 0) loaderLocation = 'https://' + loaderLocation.slice(7);
  if (loaderLocation.indexOf('//') === 0) loaderLocation = 'https:' + loaderLocation;
  if (loaderLocation.indexOf('http') !== 0) loaderLocation = 'https://' + loaderLocation.replace(/^\/+/, '');
  if (loaderLocation.slice(-1) !== '/') loaderLocation += '/';

  var x0 = loaderLocation;

  // rcid = cache-buster per minute
  var x1 = Math.ceil(Date.now() / (60 * 1000));

  function x2(src) {
    var link = document.createElement('link');
    link.type = 'text/css';
    link.rel = 'stylesheet';
    link.async = false;
    link.href = src;
    document.getElementsByTagName('head')[0].appendChild(link);
  }

  // CSS
  x2(x0 + 'css/Main.css' + '?rcid=' + x1);

  function x4(src, cb) {
    var s = document.createElement('script');
    s.type = 'text/javascript';
    s.onload = function () { cb(); };
    s.onerror = function () { cb(); };
    s.async = false;
    s.src = src;
    document.getElementsByTagName('head')[0].appendChild(s);
  }

  function x7(base, arr, addRcid, done) {
    if (arr.length > 0) {
      var loaded = 0;
      var onOne = function () {
        loaded++;
        if (loaded === arr.length) done();
      };
      for (var i = 0; i < arr.length; i++) {
        var p = arr[i];
        if (addRcid) p += ('?rcid=' + x1);
        x4(base + p, onOne);
      }
    } else done();
  }

  // ---- constants / platform map (как у тебя)
  var xf = { xg: 0, xh: 1, xi: 2, xj: 3, xk: 4, xl: 5, xm: 6, xn: 7, xo: 8, xp: 9, xq: 10, xr: 11, xs: 12, xt: 14 };
  var xu = { xv: xf.xg, xw: 0 };
  window.xu = xu;

  function xx() {
    var ua = (navigator.userAgent).toLowerCase();
    var loc = String(window.location).toLowerCase();
    var t = xf.xg;

    if (loc.indexOf('/operatv') > 0) t = xf.xo;
    else if (loc.indexOf('/nettv') > 0) t = xf.xk;
    else if (loc.indexOf('/dune') > 0) t = xf.xq;
    else if (ua.indexOf('maple') > 0) {
      t = xf.xh;
      var po = document.getElementById('pluginObjectNNavi'), fw = 'xxx-2010';
      try { fw = po.GetFirmware(); } catch (e) { }
      fw = fw.split('-');
      if (fw[1]) {
        for (var y = 2010; y < 2020; y++) {
          if (fw[1].indexOf(String(y)) !== -1) { xu.xw = y; break; }
        }
      }
    }
    else if (
      (ua.indexOf('web0s') > 0) ||
      (ua.indexOf('webos') > 0) ||
      ((ua.indexOf('webappmanager') > 0) && (ua.indexOf('safari/537.36') > 0)) ||
      ((ua.indexOf('safari/537.31') > 0) && (ua.indexOf('smarttv/5.0') > 0)) ||
      ((ua.indexOf('safari/537.31') > 0) && (ua.indexOf('smarttv/6.0') > 0))
    ) t = xf.xj;
    else if ((ua.indexOf('netcast') > 0) || (ua.indexOf('lg simplesmart.tv') > 0)) t = xf.xi;
    else if (ua.indexOf('dunehd') > 0) t = xf.xq;
    else if (
      (ua.indexOf('opera tv store') > 0) ||
      (ua.indexOf('sonycebrowser') > 0) ||
      (ua.indexOf('inettvbrowser') > 0) ||
      ((ua.indexOf('tv store') > 0) && (ua.indexOf('model/') > 0))
    ) t = xf.xo;
    else if (ua.indexOf('nettv') > 0) t = xf.xk;
    else if (!!window.tizen) { t = xf.xm; if (!!window.tizen.tv) t = xf.xm; }
    else if (ua.indexOf('tizen') > 0) t = xf.xm;
    else if ((ua.indexOf('opera') === 0) && (ua.indexOf('linux sh4') > 0)) t = xf.xn;
    else if (ua.indexOf('viera') > 0) t = xf.xp;
    else if ((window.JSTV) || (ua.indexOf('qtembedded') > 0)) t = xf.xr;
    else if (ua.indexOf('playstation') > 0) t = xf.xs;

    if (!!window.gSTB) { t = xf.xl; window.moveTo(0, 0); }
    return t;
  }

  var x15 = false;

  function x16() {
    var body = document.body;
    var d1 = document.createElement('div');
    var d2 = document.createElement('div');
    var img = document.createElement('img');

    d1.id = 'css3';
    body.appendChild(d1);
    d2.id = 'css5';
    d1.appendChild(d2);
    img.id = 'css2';
    d1.appendChild(img);

    if (xu.xv === xf.xg) img.style.background = 'rgb(0,5,80)';
  }

  // loader spinner
  var x1p, x1q = 0, x1r = [0x5c, 0x7c, 0x2f, 0x2d];
  function x1s() {
    x1p = document.createElement('div');
    x1p.style.cssText =
      'width:6em;height:1.2em;top:5%;left:3%;background:rgb(40,65,97);color:rgb(240,240,240);position:absolute;z-index:100;font-size:3em;text-align:center;border-radius:0.2em;';
    document.body.appendChild(x1p);
  }
  function x1d() {
    x1p.innerHTML = 'Loading ' + String.fromCharCode(x1r[x1q++]);
    if (x1q > 3) x1q = 0;
  }
  function x1e() {
    try { document.body.removeChild(x1p); } catch (e) { }
  }

  var x1t;
  function x1u() {
    x1t = document.createElement('div');
    x1t.style.cssText =
      'width:94%;height:1.2em;top:12%;left:3%;position:absolute;background:transparent;z-index:100;font-size:1.6em;text-align:center;border-radius:0.2em;';
    document.body.appendChild(x1t);
  }
  function x1g() { document.body.removeChild(x1t); }
  function x1v(msg) {
    x1t.style.background = 'rgb(150,80,80)';
    x1t.innerHTML = msg;
  }

  function x1b() {
    if ((x15) && (window.x1c)) {
      x1d();
      setTimeout(function () {
        x1e();
        x1f.onLoad();
        x1g();
      }, 0);
    } else {
      x1d();
      setTimeout(x1b, 100);
    }
  }

  function x1h() {
    var maple = [
      '$MANAGER_WIDGET/Common/API/Widget.js',
      '$MANAGER_WIDGET/Common/API/Plugin.js',
      '$MANAGER_WIDGET/Common/API/TVKeyValue.js'
    ];
    var lg = [];
    var webos = ['js/lib/webOSjs-0.1.0/webOS.js'];
    var tizen = ['$WEBAPIS/webapis/webapis.js'];
    var common = ['js/lib/json2.min.js', 'js/OTTWidget.js'];

    var afterCommon = function () { x15 = true; };
    var loadCommon = function () { x7(x0, common, true, afterCommon); };

    xu.xv = xx();

    // оригинальная вставка object для некоторых платформ (оставил как было логикой)
    var css0 = document.getElementsByTagName('div')[0];
    if (css0) {
      switch (xu.xv) {
        case xf.xi:
          css0.innerHTML = "<object type='application/x-netcast-info' id='netcast_device' width='0' height='0'></object>";
          break;
        case xf.xq:
          css0.innerHTML = "<object type='application/x-dune-stb-api' id='duneapi' width='0' height='0'></object>";
          break;
        default:
          if (xu.xv !== xf.xh) {
            css0.innerHTML = '';
            if (document.body) document.body.removeChild(css0);
          }
      }
    }

    x16();

    switch (xu.xv) {
      case xf.xh: x7('', maple, false, loadCommon); break;
      case xf.xi: x7('', lg, false, loadCommon); break;
      case xf.xj: x7(x0, webos, false, loadCommon); break;
      case xf.xm: x7('', tizen, false, loadCommon); break;
      default: loadCommon(); break;
    }
  }

  var x1x = false, x1y = [];

  function onLoad() {
    if (x1x) return function () { };

    x1s();
    x1u();

    window.onerror = function (error, url, line) {
      if (xu.xv !== xf.xj) x1v(error + '|' + url + '(' + line + ')');
      x1y.push({ error: error, url: url, line: line });
    };

    x1h();
    x1b();

    x1x = true;
    return function () { };
  }

  function onUnload() { try { x1f.onUnload(); } catch (e) { } }
  function onShow() { try { x1f.onShow(); } catch (e) { } }

  setTimeout(function () {
    if (document.body) document.body.onload = onLoad();
  }, 3500);

  // expose if needed
  window.onUnload = onUnload;
  window.onShow = onShow;

})();
