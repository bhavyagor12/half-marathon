import {Composition, getStaticFiles} from 'remotion';
import {Launch, type LaunchProps} from './Launch';
import {daysToRace, resolveAssets} from './assets.js';
import {DURATION, FPS} from './timeline';

export function RemotionRoot() {
  // Studio preview picks up whatever is in public/; `npm run render` passes the same props explicitly.
  const defaults = resolveAssets(getStaticFiles().map(file => file.name), daysToRace()) as LaunchProps;
  return <>
    <Composition id="LaunchLandscape" component={Launch} durationInFrames={DURATION} fps={FPS} width={1920} height={1080} defaultProps={defaults}/>
    <Composition id="LaunchPortrait" component={Launch} durationInFrames={DURATION} fps={FPS} width={1080} height={1920} defaultProps={defaults}/>
  </>;
}
