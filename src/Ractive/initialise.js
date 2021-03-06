import { logIfDebug, warnIfDebug, warnOnceIfDebug } from 'utils/log';
import { getElement } from 'utils/dom';
import { isArray } from 'utils/is';
import config from './config/config';
import Fragment from 'src/view/Fragment';
import Hook from 'src/events/Hook';
import HookQueue from 'src/events/HookQueue';
import Ractive from '../Ractive';
import subscribe from './helpers/subscribe';

const configHook = new Hook('config');
const initHook = new HookQueue('init');

export default function initialise(ractive, userOptions, options) {
  // initialize settable computeds
  const computed = ractive.viewmodel.computed;
  if (computed) {
    for (const k in computed) {
      if (k in ractive.viewmodel.value && computed[k] && !computed[k].isReadonly) {
        computed[k].set(ractive.viewmodel.value[k]);
      }
    }
  }

  // init config from Parent and options
  config.init(ractive.constructor, ractive, userOptions);

  configHook.fire(ractive);

  initHook.begin(ractive);

  const fragment = (ractive.fragment = createFragment(ractive, options));
  if (fragment) fragment.bind(ractive.viewmodel);

  initHook.end(ractive);

  // general config done, set up observers
  subscribe(ractive, userOptions, 'observe');

  // call any passed in plugins
  if (isArray(userOptions.use))
    ractive.use.apply(ractive, userOptions.use.filter(p => !p.construct));

  if (fragment) {
    // render automatically ( if `el` is specified )
    const el = (ractive.el = ractive.target = getElement(ractive.el || ractive.target));
    if (el && !ractive.component) {
      const promise = ractive.render(el, ractive.append);

      if (Ractive.DEBUG_PROMISES) {
        promise.catch(err => {
          warnOnceIfDebug(
            'Promise debugging is enabled, to help solve errors that happen asynchronously. Some browsers will log unhandled promise rejections, in which case you can safely disable promise debugging:\n  Ractive.DEBUG_PROMISES = false;'
          );
          warnIfDebug('An error happened during rendering', { ractive });
          logIfDebug(err);

          throw err;
        });
      }
    }
  }
}

export function createFragment(ractive, options = {}) {
  if (ractive.template) {
    const cssIds = [].concat(ractive.constructor._cssIds || [], options.cssIds || []);

    return new Fragment({
      owner: ractive,
      template: ractive.template,
      cssIds
    });
  }
}
