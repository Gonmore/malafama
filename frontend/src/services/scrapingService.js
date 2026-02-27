import api from './api';

const scrapingService = {
  async preview(url) {
    const response = await api.post('/scraping/preview', { url });
    return response.data;
  }
};

export default scrapingService;
