/** Native-free expo-audio surface for Jest (no AudioPlayer prototypes). */

const NOOP = () => undefined;
const NOOP_ASYNC = async () => undefined;

function createPlayer() {
  return {
    play: NOOP,
    pause: NOOP,
    seekTo: NOOP_ASYNC,
    replace: NOOP,
    remove: NOOP,
    setPlaybackRate: NOOP,
  };
}

function useAudioPlayer() {
  return createPlayer();
}

function useAudioPlayerStatus() {
  return {
    playing: false,
    isLoaded: false,
    duration: 0,
    currentTime: 0,
    didJustFinish: false,
  };
}

module.exports = {
  __esModule: true,
  useAudioPlayer,
  useAudioPlayerStatus,
  createAudioPlayer: createPlayer,
  setAudioModeAsync: NOOP_ASYNC,
  setIsAudioActiveAsync: NOOP_ASYNC,
};
