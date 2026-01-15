import axios from 'axios';

export class ImageService {
  private apiKey: string | undefined = process.env.BFL_API_KEY;
  private baseUrl: string = "https://api.bfl.ai/v1";

  async generateBackground(prompt: string, referenceImages: string[] = []): Promise<string> {
    if (!this.apiKey) {
      console.warn('[ImageService] BFL_API_KEY not set. Using placeholder image.');
      return `https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=1000&auto=format&fit=crop`;
    }

    try {
      console.log(`[ImageService] Generating background: "${prompt.substring(0, 50)}..."`);
      
      // Step 1: Submit generation request
      const payload: any = {
        prompt: prompt,
        width: 1024,
        height: 576,
        output_format: "jpeg"
      };
      
      // Add reference images if provided (max 4)
      if (referenceImages && referenceImages.length > 0) {
        referenceImages.slice(0, 4).forEach((img, i) => {
          payload[i === 0 ? 'input_image' : `input_image_${i + 1}`] = img;
        });
      }
      
      const submitResponse = await axios.post(`${this.baseUrl}/flux-2-klein-9b`, payload, {
        headers: {
          'accept': 'application/json',
          'x-key': this.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });

      const pollingUrl = submitResponse.data.polling_url;
      console.log(`[ImageService] Task submitted, polling...`);
      
      // Step 2: Poll for results (max 20 attempts = 10 seconds)
      for (let i = 0; i < 20; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const pollResponse = await axios.get(pollingUrl, {
          headers: {
            'accept': 'application/json',
            'x-key': this.apiKey
          },
          timeout: 5000
        });
        
        if (pollResponse.data.status === 'Ready') {
          const imageUrl = pollResponse.data.result.sample;
          console.log(`[ImageService] ✅ Image generated (${i + 1} polls)`);
          return imageUrl;
        } else if (pollResponse.data.status === 'Error') {
          console.error('[ImageService] Generation error:', pollResponse.data.error);
          return "";
        }
      }
      
      console.warn('[ImageService] Polling timeout');
      return "";
      
    } catch (err: any) {
      console.error('[ImageService] BFL failed:', err.message);
      return "";
    }
  }

  async editImage(baseImage: string, instruction: string): Promise<string> {
    // Image editing not yet supported by FLUX.2 klein
    console.warn('[ImageService] Image editing not implemented for FLUX.2 klein');
    return "";
  }
}

export const imageService = new ImageService();
