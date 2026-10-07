"""API d'inférence du GAN audio → vidéo, à déployer sur un Space Hugging Face (SDK Gradio).

Contrat avec le site : une entrée audio (chemin de fichier), une sortie vidéo MP4.
Le site appelle l'endpoint "/predict" (voir content/projets/gan-audio-video.md).
"""
import gradio as gr


def generate(audio_path: str) -> str:
    """Charge l'audio, appelle le générateur et renvoie le chemin d'un MP4.

    À remplacer par ton code :
      1. charger les poids une seule fois, au niveau du module (pas à chaque appel)
      2. audio -> spectrogramme -> fenêtres -> générateur -> images
      3. assembler les images + l'audio en MP4 (ex. imageio-ffmpeg ou moviepy)
    """
    raise NotImplementedError("Branche ici ton générateur")


demo = gr.Interface(
    fn=generate,
    inputs=gr.Audio(type="filepath", label="Audio"),
    outputs=gr.Video(label="Vidéo générée"),
    title="GAN audio → vidéo",
    api_name="predict",
)

if __name__ == "__main__":
    demo.queue(max_size=8).launch()
