import axios from 'axios';

export class ImageService {
  private apiKey: string | undefined = process.env.BFL_API_KEY;
  private baseUrl: string = "https://api.bfl.ml/v1"; // Placeholder, assuming BFL standard

  async generateBackground(prompt: string, referenceImages: string[] = []): Promise<string> {
    if (!this.apiKey) {
      console.warn('[ImageService] BFL_API_KEY not set. Using placeholder image.');
      return `https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=1000&auto=format&fit=crop`;
    }

    try {
      console.log(`[ImageService] Generating reactive background for: "${prompt.substring(0, 50)}..."`);
      
      const response = await axios.post(`${this.baseUrl}/flux-2-klein-4b`, {
        prompt: prompt,
        width: 1024,
        height: 576,
        reference_images: (referenceImages || []).slice(0, 4),
        steps: 1, // Klein is optimized for speed
        output_format: "webp"
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10s timeout for first-gen/slower models
      });

      // Assuming BFL returns a URL or base64 in a standard format
      return response.data.image_url || response.data.images?.[0]?.url || "";
    } catch (err) {
      console.error('[ImageService] BFL Generation failed:', err);
      return "";
    }
  }

  async editImage(baseImage: string, instruction: string): Promise<string> {
    if (!this.apiKey) return "";

    try {
      const response = await axios.post(`${this.baseUrl}/flux-2-klein-edit`, {
        image: baseImage,
        prompt: instruction,
        output_format: "webp"
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      return response.data.image_url || "";
    } catch (err) {
      console.error('[ImageService] BFL Edit failed:', err);
      return "";
    }
  }
}

export const imageService = new ImageService();
