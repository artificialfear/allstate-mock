/* Glue so Band Arcade's First Sight engine (vendor/first-sight/, copied unchanged) runs inside the mock tool.
   The engine expects the arcade's sound output (Arcade.Sfx.output()); here it is one AudioContext of our own,
   created on the first tap (browsers block audio before that). Nothing listens to a microphone in this tool. */
window.Arcade = window.Arcade || {};
(function (A) {
  'use strict';
  let ctx = null, out = null;
  A.Sfx = A.Sfx || {
    output() {
      try {
        if (!ctx) {
          const C = window.AudioContext || window.webkitAudioContext;
          if (!C) return null;
          ctx = new C();
          out = ctx.createGain();
          out.gain.value = 0.9;
          out.connect(ctx.destination);
        }
        return { ctx, out };
      } catch (e) { return null; }
    },
  };
})(window.Arcade);
