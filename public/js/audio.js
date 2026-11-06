// audio.js — Audio playback with offline fallback
const Audio = (function() {
  let currentAudio = null;

  /**
   * Play scheme audio. Tries:
   * 1. Locale-specific pre-recorded file
   * 2. Fallback to Marathi (mr)
   * 3. Fallback to Web Speech API if available
   */
  async function playSchemeAudio(schemeId, locale) {
    stopCurrent();

    const audioPath = `/audio/${locale}/${schemeId}.mp3`;
    try {
      currentAudio = new window.Audio(audioPath);
      await currentAudio.play();
      return;
    } catch (e) {
      console.warn(`Audio not found: ${audioPath}`);
    }

    // Fallback: Marathi
    if (locale !== 'mr') {
      try {
        currentAudio = new window.Audio(`/audio/mr/${schemeId}.mp3`);
        await currentAudio.play();
        return;
      } catch (e) {
        console.warn('Marathi audio fallback failed');
      }
    }

    // Final fallback: Web Speech API (browser TTS)
    if ('speechSynthesis' in window) {
      const text = I18n.t(`scheme.${schemeId}.short`);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = locale === 'mr' ? 'mr-IN' : 'en-IN';
      utterance.rate = 0.9;
      speechSynthesis.speak(utterance);
    }
  }

  function stopCurrent() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    }
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
  }

  return { playSchemeAudio, stopCurrent };
})();