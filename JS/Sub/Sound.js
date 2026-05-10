/* Sound Manager using Howler.js */
/* NOTE: This file is not used in the current build (Script.js contains stubs).
   Keep for future integration. */
   import { Howl } from './Howler.js';

   export const SFX = {
     main: null,
     enterSnd: null,
     ambience: null,
   
     init() {
       // Basic enter sound (procedural beep since no assets)
       this.enterSnd = new Howl({
         src: ['data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJzrL5Jkm9tUk/f8NkwCzQFgx'], // silent placeholder
         volume: 0.6
       });
   
       // Stub main SFX
       this.main = {
         play: (snd) => {
           if (snd === 'expand') console.log('SFX: expand');
           // Add more stubs as needed
         },
         volume: (vol) => {},
         mute: (muted) => {}
       };
   
       // Ambient stub
       this.ambience = {
         play: () => console.log('Ambience start'),
         volume: (vol) => {}
       };
     }
   };
   
   // Auto-init
   SFX.init();
   console.log('SFX initialized');