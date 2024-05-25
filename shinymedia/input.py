import os
import tempfile
from pathlib import Path, PurePath
from .utils import file_to_data_uri, data_uri_to_tempfile
import ffmpeg


class DecodedInput:
    audio: PurePath
    images: tuple[PurePath, ...]

    def __init__(
        self,
        audio: PurePath,
        images: tuple[PurePath, ...],
        tmpdir: tempfile.TemporaryDirectory,
    ):
        self.audio = audio
        self.images = images
        self.tmpdir = tmpdir

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        print("Cleaning up " + self.tmpdir.name)
        self.tmpdir.cleanup()


def decode_input(video_uri_or_file: str, fps: int = 2) -> DecodedInput:
    if os.path.isfile(video_uri_or_file):
        video_uri = file_to_data_uri(video_uri_or_file)

    with tempfile.TemporaryDirectory() as outdir:
        audio = PurePath(outdir) / "audio.mp3"
        with data_uri_to_tempfile(video_uri) as video_file:
            (
                ffmpeg.input(video_file)
                .output(
                    str(audio),
                    loglevel="error",
                    **{
                        # Use 64k bitrate for smaller file
                        "b:a": "64k",
                        # Only output one channel, again for smaller file
                        "ac": "1",
                    },
                )
                .run()
            )
            (
                ffmpeg.input(video_file)
                .output(
                    str(PurePath(outdir) / "frame-%04d.jpg"),
                    loglevel="error",
                    **{
                        # Use fps as specified, scale image to fit within 512x512
                        "vf": f"fps={fps},scale='if(gt(iw,ih),512,-1)':'if(gt(ih,iw),512,-1)'",
                        "q:v": "20",
                    },
                )
                .run()
            )
        images = list(Path(outdir).glob("*.jpg"))
        images.sort()
        return file_to_data_uri(audio), [file_to_data_uri(image) for image in images]


if __name__ == "__main__":
    with decode_input(PurePath("data/question.mov")) as input:
        print(input.audio)
        print(input.images)
