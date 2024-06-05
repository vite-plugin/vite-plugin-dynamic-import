(() => {
  async function setView(id: string) {
    const url = "http://localhost:3000"; const { msg } = await import(`@/${id}`)
    document.querySelector('.view')!.innerHTML = msg + url;
  }

  const views = [
    {
      'comments-test-alias': () => setView('foo'),
    },
  ]

  for (const view of views) {
    Object.entries(view).forEach(([className, cb]) => {
      document.querySelector(`.${className}`)!.addEventListener('click', ev => {
        (ev.target as HTMLButtonElement).classList.add('active')
        cb()
      })
    })
  }
})();
