/**
 * One place for every number and asset path the arena cares about.
 * Paths are resolved against the page URL so the same build works from
 * the domain root (Vercel) and from a subfolder (GitHub Pages).
 */

const base = document.baseURI;
const asset = (path) => new URL(path.replace(/^\.?\//, ''), base).href;

export const MODEL = Object.freeze({
  catdogUrl: asset('models/catdog/model.json'),
  imagenetUrl: asset('models/imagenet/model.json'),
  labelsUrl: asset('imagenet-simple-labels.json'),

  // Input nodes, read out of the exported graph models.
  catdogInput: 'input_layer_2',
  imagenetInput: 'keras_tensor_487',

  size: 160,
  dogLabel: 1,
  threshold: 0.65,

  // ImageNet classes 151..285 are dogs, wild canids and cats.
  gateStart: 151,
  gateEnd: 286, // exclusive
  gateMass: 0.1,
});

export const SAMPLES = Object.freeze([
  { id: 'cat', label: 'Cat', url: asset('samples/cat.jpg') },
  { id: 'dog', label: 'Dog', url: asset('samples/dog.jpg') },
  { id: 'toaster', label: 'Toaster', url: asset('samples/toaster.jpg') },
]);

export const EMOJI = Object.freeze({
  cat: [asset('emoji/1f431.svg'), asset('emoji/1f408.svg')],
  dog: [asset('emoji/1f436.svg'), asset('emoji/1f415.svg')],
});

export const COPY = Object.freeze({
  titles: {
    cat: 'CAT WINS',
    dog: 'DOG WINS',
    draw: 'NO CONTEST',
    disq: 'REJECTED',
  },
  kickers: {
    cat: 'The judges have decided',
    dog: 'The judges have decided',
    draw: 'A split decision',
    disq: 'Exhibit rejected',
  },
  lines: {
    cat: [
      'The dog is appealing. The appeal was denied.',
      'The dog brought paws to a claw fight.',
      'Scientific opinion has been overruled by a cat.',
      'The dog had heart. The cat had a plan.',
      'Judges’ scorecard: fluff, then devastation.',
    ],
    dog: [
      'The cat has been asked to leave the premises.',
      'The cat declined to comment, then fell asleep.',
      'The dog wins on enthusiasm, and it is not close.',
      'The cat had altitude. The dog had momentum.',
      'A clean sweep. Somebody get the cat a snack.',
    ],
    draw: [
      'The judges have seen enough. Nobody wins.',
      'A split decision: both sides are pretty sure.',
      'Two very convincing animals. One indecisive model.',
      'The tape is inconclusive. The pets are unbothered.',
      'This one gets filed under “ask again later”.',
    ],
    disq: [
      'This is not a pet. The arena has standards.',
      'The judges request a cat, a dog, or at least a mammal.',
      'A bold entry. Wrong species entirely.',
      'The gate says no. The gate is rarely wrong.',
      'Interesting object. Not a contender.',
    ],
  },
});
