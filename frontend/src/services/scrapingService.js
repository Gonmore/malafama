import api from './api';

const scrapingService = {
  async startPreviewJob(url) {
    const response = await api.post('/scraping/preview-job', { url });
    return response.data;
  },

  async getPreviewJob(jobId) {
    const response = await api.get(`/scraping/preview-job/${jobId}`);
    return response.data;
  },

  async preview(url) {
    const response = await api.post('/scraping/preview', { url });
    return response.data;
  }
};

export default scrapingService;
