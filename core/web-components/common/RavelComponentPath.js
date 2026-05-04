// If building with Webpack, honor the __RAVEL_COMPONENT_BASE__ value instead
export const componentPath =
  (typeof __RAVEL_COMPONENT_BASE__ !== "undefined" && __RAVEL_COMPONENT_BASE__)
  || (() => {
    const pathItems = import.meta.url.split("//")[1].split("/");
    return pathItems.length === 0 ? "" : "/" + pathItems.slice(1, -2).join("/");
  })();