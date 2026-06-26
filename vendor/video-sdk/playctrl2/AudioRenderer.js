<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,user-scalable=no,initial-scale=1,maximum-scale=1,minimum-scale=1"><meta http-equiv="X-UA-Compatible" content="ie=edge"><script src="/yiheng-common-web/static/env/apm.env.js"></script><script defer="" src="/iot-message-notification/video-sdk/h5player.min.js"></script><script defer="" src="/iot-message-notification/dahua-rtsp-sdk/scripts/videoPlayer.js"></script><script defer="" src="/iot-message-notification/video-sdk/hik-rtsp/webVideoCtrl.js"></script><script>let _loadStyles = function () {
                let prefix = window.apmCommonEnv ? window.apmCommonEnv.INTERFACE_PREFIX_APM_STATIC_CONFIG : undefined;
                let createLink = function (url, id) {
                    let urlLink = document.createElement('link');
                    urlLink.rel = 'stylesheet';
                    urlLink.id = id;
                    urlLink.href = url;
                    document.head.prepend(urlLink);
                };
                let isLinkExists = function (id) {
                    let node = document.querySelector('link[id="' + id + '"]');
                    return node === null;
                };
                if (prefix !== undefined) {
                    isLinkExists('commoncss') && createLink(`${prefix}/styles/common.css`, 'commoncss');
                    isLinkExists('variablescss') && createLink(`${prefix}/styles/variables.css`, 'variablescss');
                    isLinkExists('fontcss') && createLink(`${prefix}/styles/font/font.css`, 'fontcss');
                }
            };

            _loadStyles();</script><script crossorigin="">const _quankun = {};
  const createDeffer = (hookName) => {
    const d = new Promise((resolve, reject) => {
      _quankun[`vite${hookName}`] = resolve;
    })
    return props => d.then(fn => fn(props));
  }
  const bootstrap = createDeffer('bootstrap');
  const mount = createDeffer('mount');
  const unmount = createDeffer('unmount');
  const update = createDeffer('update');

  ;(global => {
    global['iot-message-notification'] = {
      bootstrap,
      mount,
      unmount,
      update
    };
  })(window);

          import((window.proxy ? (window.proxy.__INJECTED_PUBLIC_PATH_BY_QIANKUN__ + '..') : '') + '/iot-message-notification/assets/iot-message-notification-main.dLsEyLor.js').finally(() => {
            
    const qiankunLifeCycle = window.moudleQiankunAppLifeCycles;
    if (qiankunLifeCycle) {
      _quankun.vitemount((props) => qiankunLifeCycle.mount(props));
      _quankun.viteunmount((props) => qiankunLifeCycle.unmount(props));
      _quankun.vitebootstrap(() => qiankunLifeCycle.bootstrap());
      _quankun.viteupdate((props) => qiankunLifeCycle.update(props));
    }
  
          })</script><link rel="stylesheet" crossorigin="" href="/iot-message-notification/assets/iot-message-notification-main.f_YSKsu2.css"></head><body style="overflow:hidden"><noscript><strong>We're sorry but early doesn't work properly without JavaScript enabled. Please enable it to continue.</strong></noscript><div id="iot-message-notification" style="width:100%;height:100%"></div></body></html>