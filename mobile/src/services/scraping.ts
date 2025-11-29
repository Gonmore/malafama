import api from './api';

export const scrapingService = {
  previewUrl: async (url: string) => {
    const { data } = await api.get('/scraping/preview-url', { params: { url } });
    return data;
  },
  preview: async (url: string) => {
    const { data } = await api.post('/scraping/preview', { url });
    return data;
  },
  scrapearMenu: async (url: string, metodo?: string) => {
    const body: any = { url };
    if (metodo) body.metodo = metodo;
    const { data } = await api.post('/scraping/menu', body);
    return data;
  },
  importar: async (productos: any[]) => {
    const { data } = await api.post('/scraping/import', { productos });
    return data;
  },
  confirmar: async (productos: any[]) => {
    const { data } = await api.post('/scraping/confirmar', { productos });
    return data;
  }
};
