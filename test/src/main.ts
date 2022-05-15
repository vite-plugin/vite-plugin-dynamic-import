(() => {
  async function setView1(id: string) {
    const { msg } = await import(`@/views/${id}.js`)
    document.querySelector('.view')!.innerHTML = msg
  }
  async function setView2(id: string) {
    const { msg } = await import(`src/views/${id}.mjs`)
    document.querySelector('.view')!.innerHTML = msg
  }
  async function setView3(id: string) {
    const { msg } = await import(`/root/src/views/${id}`)
    document.querySelector('.view')!.innerHTML = msg
  }
  async function setView4(id: string) {
    // This will match all modules under `views` as far as possible
    const { msg } = await import(`./views${id}`)
    document.querySelector('.view')!.innerHTML = msg
  }
  async function setView5(id: string) {
    // This will match all modules ending in `.tsx` under `views` as far as possible
    const { msg } = await import(`./views${id}.tsx`)
    document.querySelector('.view')!.innerHTML = msg
  }
  async function setView6() {
    // After `expressiontoglob` processing, it may become a normal path
    const { msg } = await import('@/views/' + 'foo.js')
    document.querySelector('.view')!.innerHTML = msg
  }
  async function setView7(id: string) {
    const { msg } = await import(`@/${id}`)
    document.querySelector('.view')!.innerHTML = msg
  }

  const views = [
    {
      'foo-alias1': () => setView1('foo'),
    },
    {
      'bar-alias2': () => setView2('bar'),
    },
    {
      'foo-alias3': () => setView3('foo'),
      'bar-alias3': () => setView3('bar'),
      'baz-alias3': () => setView3('baz'),
      'home-alias3': () => setView3('home'),
    },
    {
      'may-foo': () => setView4('/foo'),
      'may-bar': () => setView4('/bar'),
      'may-nesting': () => setView4('/nested/nesting'),
      'may-nesting-dir': () => setView4('/nested/nesting-dir'),
    },
    {
      'may-ext-baz': () => setView5('/baz/index'),
      'may-ext-nesting-dir': () => setView5('/nested/nesting-dir/index'),
    },
    {
      'may-normally-alias': () => setView6(),
    },
    {
      'only-alias': () => setView7('views/baz'),
    },
  ]

  for (const view of views) {
    Object.entries(view).forEach(([className, cb]) => {
      document.querySelector(`.${className}`)!.addEventListener('click', cb)
    })
  }
})();
