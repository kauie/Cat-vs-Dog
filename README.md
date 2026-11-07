# CAT v DOG

One photo. One verdict. A MobileNetV2 trained on 12,000 cats and dogs argues with itself in your browser.

Nothing is uploaded. The 11 MB of model weights download once and then inference runs on your device. The page is a static Vite build, so it deploys anywhere (Vercel, GitHub Pages, Netlify) with no backend.

## Run it locally

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # output in dist/
npm run preview      # serve the build on http://localhost:4173
```

## How the verdict works

1. The photo is stretched to 160 × 160 and scaled to `[-1, 1]` (MobileNetV2 preprocessing).
2. It is scored twice, straight and mirrored, and the two passes are averaged — so a sideways cat still gets a fair hearing.
3. A cat/dog head produces `p_dog`; an ImageNet gate checks the photo is a pet at all (classes 151–285, plus a 10% mass threshold).
4. Priority of outcomes:
   - not a pet → **REJECTED**
   - confidence below 65% → **NO CONTEST**
   - otherwise → **CAT WINS** or **DOG WINS**

## Motion

The page respects your system's "reduce motion" preference and starts in **Motion: off** when it is on. Click **Motion** in the header to turn the rain, the fight and the transitions on. The preference is remembered for the session only.

## Credits

- Emoji art: [Twemoji](https://twemoji.twitter.com/), CC-BY 4.0
- Cat and dog sample photos: [Unsplash](https://unsplash.com)
- Toaster sample photo: Leon Brooks, public domain (Wikimedia Commons)
- Model: MobileNetV2, fine-tuned on the Kaggle Cats vs Dogs set, converted to TensorFlow.js graph models
- Display type: [Anybody](https://fonts.google.com/specimen/Anybody); body and mono: [Spline Sans](https://fonts.google.com/specimen/Spline+Sans) / [Spline Sans Mono](https://fonts.google.com/specimen/Spline+Sans+Mono)
