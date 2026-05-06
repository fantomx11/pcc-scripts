const { h, render } = await import('https://esm.sh/preact');
const { default: htm } = await import('https://esm.sh/htm');

export const html = htm.bind(h);
