"""Export a trained Keras cat/dog (or ImageNet) model to the TF.js graph model
the site expects.

Run after training, in the same environment that produced the model:

    python tools/export_tfjs.py catdog.keras public/models/catdog
    python tools/export_tfjs.py imagenet.keras public/models/imagenet

The resulting folder must contain model.json + group1-shard*.bin and a
model_meta.json with {"img_size": 160, "dog_is_label_1": true, "threshold": 0.65}.
"""
import argparse
import json
import os
import subprocess
import sys


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("keras_model", help="path to a saved Keras .keras/.h5 model")
    parser.add_argument("out_dir", help="destination folder under public/models/")
    parser.add_argument("--img-size", type=int, default=160)
    args = parser.parse_args()

    os.makedirs(args.out_dir, exist_ok=True)

    # tensorflowjs_converter ships with the tensorflowjs package.
    cmd = [
        "tensorflowjs_converter",
        "--input_format=keras",
        "--output_format=tfjs_graph_model",
        args.keras_model,
        args.out_dir,
    ]
    print("Running:", " ".join(cmd))
    subprocess.run(cmd, check=True)

    meta_path = os.path.join(args.out_dir, "model_meta.json")
    if not os.path.exists(meta_path):
        with open(meta_path, "w", encoding="utf-8") as fh:
            json.dump(
                {"img_size": args.img_size, "dog_is_label_1": True, "threshold": 0.65},
                fh,
            )
        print("Wrote", meta_path)

    print("Done. Check the input node names in model.json match src/config.js.")


if __name__ == "__main__":
    main()
