/* @flow */

import { install } from './install'
import { createMatcher } from './create-matcher'
import { HashHistory, getHash } from './history/hash'
import { HTML5History, getLocation } from './history/html5'
import { AbstractHistory } from './history/abstract'
import { inBrowser, supportsHistory } from './util/dom'
import { assert } from './util/warn'

export default class VueRouter {
  static install: () => void;

  app: any;
  options: RouterOptions;
  mode: string;
  history: HashHistory | HTML5History | AbstractHistory;
  match: Matcher;
  fallback: boolean;
  beforeHooks: Array<?NavigationGuard>;
  afterHooks: Array<?((to: Route, from: Route) => any)>;

  constructor(options: RouterOptions = {}) {
    this.app = null
    this.options = options
    this.beforeHooks = []
    this.afterHooks = []
    // 创建match匹配函数
    this.match = createMatcher(options.routes || [])
    // 判断mode
    let mode = options.mode || 'hash'
    // supportsHistory用来判断当前浏览器是否支持history模式
    this.fallback = mode === 'history' && !supportsHistory
    // 如果当前浏览器不支持history,则回滚为hash模式
    if (this.fallback) {
      mode = 'hash'
    }
    // 如果当前环境不是浏览器,则设置为abstract模式
    if (!inBrowser) {
      mode = 'abstract'
    }
    this.mode = mode
    // 根据mode不同,而实例化不同的history
    switch (mode) {
      case 'history':
        this.history = new HTML5History(this, options.base)
        break
      case 'hash':
        this.history = new HashHistory(this, options.base, this.fallback)
        break
      case 'abstract':
        this.history = new AbstractHistory(this)
        break
      default:
        assert(false, `invalid mode: ${mode}`)
    }
  }

  get currentRoute(): ?Route {
    return this.history && this.history.current
  }

  init(app: any /* Vue component instance */) {
    assert(
      install.installed,
      `not installed. Make sure to call \`Vue.use(VueRouter)\` ` +
      `before creating root instance.`
    )
    // 将vue实例赋值给app
    this.app = app
    const history = this.history
    /*
     针对HTML5History和HashHistory进行特殊处理
     因为在这两种模式下会存在进入的时候并非默认页
     (例如默认页为/base,可以打开/base/bar,然后刷新,此时路由不变,但进入时并非默认页),
     需要根据当前地址栏的path或者hash来激活对应的路由,加载正确的组件
     */
    if (history instanceof HTML5History) {
      history.transitionTo(getLocation(history.base))
    } else if (history instanceof HashHistory) {
      history.transitionTo(getHash(), () => {
        window.addEventListener('hashchange', () => {
          history.onHashChange()
        })
      })
    }

    history.listen(route => {
      this.app._route = route
    })
  }

  beforeEach(fn: Function) {
    this.beforeHooks.push(fn)
  }

  afterEach(fn: Function) {
    this.afterHooks.push(fn)
  }

  push(location: RawLocation) {
    this.history.push(location)
  }

  replace(location: RawLocation) {
    this.history.replace(location)
  }

  go(n: number) {
    this.history.go(n)
  }

  back() {
    this.go(-1)
  }

  forward() {
    this.go(1)
  }

  getMatchedComponents(): Array<any> {
    if (!this.currentRoute) {
      return []
    }
    return [].concat.apply([], this.currentRoute.matched.map(m => {
      return Object.keys(m.components).map(key => {
        return m.components[key]
      })
    }))
  }
}

VueRouter.install = install

if (inBrowser && window.Vue) {
  window.Vue.use(VueRouter)
}
