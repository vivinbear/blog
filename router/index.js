class Routers {
  constructor() {
    this.routes = {};
    this.currentUrl = ''
    this.refresh = this.refresh.bind(this)
    window.addEventListener('load', this.refresh, false);
    window.addEventListener('hashchange', this.refresh, false);
  }
  route(path, callback) {
    this.routes[path] = callback || function () { }
  }
  refresh() {
    console.log(location)
    this.currentUrl = location.hash.slice(1) || '/';
    this.routes[this.currentUrl]();
  }
}

const route = new Routers()
route.route('/red', () => { console.log('red') })
route.route('/green', () => { console.log('green') })
route.route('/yellow', () => { console.log('yellow') })
