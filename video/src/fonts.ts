import {continueRender, delayRender, staticFile} from 'remotion';

// The site's own typefaces (Geist, OFL). Rendering waits until they are ready.
const load = (family: string, file: string) => {
  const handle = delayRender(`Loading ${family}`);
  new FontFace(family, `url('${staticFile(file)}') format('woff2')`, {weight: '100 900'})
    .load()
    .then(face => { document.fonts.add(face); continueRender(handle); })
    .catch(error => { console.error(error); continueRender(handle); });
};

load('Geist', 'fonts/geist-latin.woff2');
load('Geist Mono', 'fonts/geist-mono-latin.woff2');
