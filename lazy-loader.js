// lazy-loader.js — Lazy Loading Helper untuk Evora Donuts
// Karena aplikasi menggunakan React UMD, kita buat lazy loading manual

const LazyLoader = {
  cache: {},

  // Lazy load komponen
  load: (name, loader) => {
    if (LazyLoader.cache[name]) {
      return LazyLoader.cache[name];
    }

    const Component = React.lazy(loader);
    LazyLoader.cache[name] = Component;
    return Component;
  },

  // Wrapper dengan Suspense
  SuspenseWrapper: (Component, fallback = "Memuat...") => {
    return React.createElement(
      React.Suspense,
      {
        fallback: React.createElement("div", {
          className: "loading-shell",
          style: { padding: "40px 20px", textAlign: "center" }
        }, fallback)
      },
      React.createElement(Component)
    );
  }
};

window.LazyLoader = LazyLoader;