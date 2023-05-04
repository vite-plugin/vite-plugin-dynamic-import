(() => {
  async function setView1(id) {
    const { msg } = await __variableDynamicImportRuntime0__(`@/views/${id}.js`);
    document.querySelector(".view").innerHTML = msg;
  }
  async function setView2(id) {
    const { msg } = await __variableDynamicImportRuntime1__(`src/views/${id}.mjs`);
    document.querySelector(".view").innerHTML = msg;
  }
  async function setView3(id) {
    const { msg } = await __variableDynamicImportRuntime2__(`/root/src/views/${id}`);
    document.querySelector(".view").innerHTML = msg;
  }
  async function setView4(id) {
    const { msg } = await __variableDynamicImportRuntime3__(`./views${id}`);
    document.querySelector(".view").innerHTML = msg;
  }
  async function setView5(id) {
    const { msg } = await __variableDynamicImportRuntime4__(`./views${id}.tsx`);
    document.querySelector(".view").innerHTML = msg;
  }
  async function setView6() {
    const { msg } = await import("./views/foo.js");
    document.querySelector(".view").innerHTML = msg;
  }
  async function setView7(id) {
    const { msg } = await __variableDynamicImportRuntime5__(`@/${id}`);
    document.querySelector(".view").innerHTML = msg;
  }
  const views = [
    {
      "foo-alias1": () => setView1("foo")
    },
    {
      "bar-alias2": () => setView2("bar")
    },
    {
      "foo-alias3": () => setView3("foo"),
      "bar-alias3": () => setView3("bar"),
      "baz-alias3": () => setView3("baz"),
      "home-alias3": () => setView3("home")
    },
    {
      "may-foo": () => setView4("/foo"),
      "may-bar": () => setView4("/bar"),
      "may-nesting": () => setView4("/nested/nesting"),
      "may-nesting-dir": () => setView4("/nested/nesting-dir")
    },
    {
      "may-ext-baz": () => setView5("/baz/index"),
      "may-ext-nesting-dir": () => setView5("/nested/nesting-dir/index")
    },
    {
      "may-normally-alias": () => setView6()
    },
    {
      "only-alias": () => setView7("views/baz")
    }
  ];
  for (const view of views) {
    Object.entries(view).forEach(([className, cb]) => {
      document.querySelector(`.${className}`).addEventListener("click", (ev) => {
        ev.target.classList.add("active");
        cb(ev);
      });
    });
  }
})();
// [vite-plugin-dynamic-import] runtime -S-
function __variableDynamicImportRuntime0__(path) {
  switch (path) {
    case '@/views/foo':
    case '@/views/foo.js':
      return import('./views/foo.js');
    default: return new Promise(function(resolve, reject) {
      (typeof queueMicrotask === 'function' ? queueMicrotask : setTimeout)(
        reject.bind(null, new Error("Unknown variable dynamic import: " + path))
      );
    })
  }
}
function __variableDynamicImportRuntime1__(path) {
  switch (path) {
    case 'src/views/bar':
    case 'src/views/bar.mjs':
      return import('./views/bar.mjs');
    default: return new Promise(function(resolve, reject) {
      (typeof queueMicrotask === 'function' ? queueMicrotask : setTimeout)(
        reject.bind(null, new Error("Unknown variable dynamic import: " + path))
      );
    })
  }
}
function __variableDynamicImportRuntime2__(path) {
  switch (path) {
    case '/root/src/views/bar':
    case '/root/src/views/bar.mjs':
      return import('./views/bar.mjs');
    case '/root/src/views/foo':
    case '/root/src/views/foo.js':
      return import('./views/foo.js');
    case '/root/src/views/baz':
    case '/root/src/views/baz/index':
    case '/root/src/views/baz/index.tsx':
      return import('./views/baz/index.tsx');
    case '/root/src/views/home':
    case '/root/src/views/home/index':
    case '/root/src/views/home/index.ts':
      return import('./views/home/index.ts');
    case '/root/src/views/nested/nesting':
    case '/root/src/views/nested/nesting.ts':
      return import('./views/nested/nesting.ts');
    case '/root/src/views/nested/nesting-dir':
    case '/root/src/views/nested/nesting-dir/index':
    case '/root/src/views/nested/nesting-dir/index.tsx':
      return import('./views/nested/nesting-dir/index.tsx');
    default: return new Promise(function(resolve, reject) {
      (typeof queueMicrotask === 'function' ? queueMicrotask : setTimeout)(
        reject.bind(null, new Error("Unknown variable dynamic import: " + path))
      );
    })
  }
}
function __variableDynamicImportRuntime3__(path) {
  switch (path) {
    case './views/bar':
    case './views/bar.mjs':
      return import('./views/bar.mjs');
    case './views/foo':
    case './views/foo.js':
      return import('./views/foo.js');
    case './views/baz':
    case './views/baz/index':
    case './views/baz/index.tsx':
      return import('./views/baz/index.tsx');
    case './views/home':
    case './views/home/index':
    case './views/home/index.ts':
      return import('./views/home/index.ts');
    case './views/nested/nesting':
    case './views/nested/nesting.ts':
      return import('./views/nested/nesting.ts');
    case './views/nested/nesting-dir':
    case './views/nested/nesting-dir/index':
    case './views/nested/nesting-dir/index.tsx':
      return import('./views/nested/nesting-dir/index.tsx');
    default: return new Promise(function(resolve, reject) {
      (typeof queueMicrotask === 'function' ? queueMicrotask : setTimeout)(
        reject.bind(null, new Error("Unknown variable dynamic import: " + path))
      );
    })
  }
}
function __variableDynamicImportRuntime4__(path) {
  switch (path) {
    case './views/baz':
    case './views/baz/index':
    case './views/baz/index.tsx':
      return import('./views/baz/index.tsx');
    case './views/nested/nesting-dir':
    case './views/nested/nesting-dir/index':
    case './views/nested/nesting-dir/index.tsx':
      return import('./views/nested/nesting-dir/index.tsx');
    default: return new Promise(function(resolve, reject) {
      (typeof queueMicrotask === 'function' ? queueMicrotask : setTimeout)(
        reject.bind(null, new Error("Unknown variable dynamic import: " + path))
      );
    })
  }
}
function __variableDynamicImportRuntime5__(path) {
  switch (path) {
    case '@/views/bar':
    case '@/views/bar.mjs':
      return import('./views/bar.mjs');
    case '@/views/foo':
    case '@/views/foo.js':
      return import('./views/foo.js');
    case '@/views/baz':
    case '@/views/baz/index':
    case '@/views/baz/index.tsx':
      return import('./views/baz/index.tsx');
    case '@/views/home':
    case '@/views/home/index':
    case '@/views/home/index.ts':
      return import('./views/home/index.ts');
    case '@/views/nested/nesting':
    case '@/views/nested/nesting.ts':
      return import('./views/nested/nesting.ts');
    case '@/views/nested/nesting-dir':
    case '@/views/nested/nesting-dir/index':
    case '@/views/nested/nesting-dir/index.tsx':
      return import('./views/nested/nesting-dir/index.tsx');
    default: return new Promise(function(resolve, reject) {
      (typeof queueMicrotask === 'function' ? queueMicrotask : setTimeout)(
        reject.bind(null, new Error("Unknown variable dynamic import: " + path))
      );
    })
  }
}
// [vite-plugin-dynamic-import] runtime -E-