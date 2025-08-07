// services/chatService.js
const axios = require('axios');

class ChatService {
  constructor() {
    // Config Gemini (v1 + modelos 1.5)
    this.gemini = {
      baseURL: (process.env.LLM_BASE_URL || 'https://generativelanguage.googleapis.com/v1').replace(/\/$/, ''),
      apiKey: process.env.GEMINI_API_KEY || '',
      model: (process.env.LLM_MODEL || 'gemini-1.5-flash-latest').trim(),
      temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.7'),
      maxOutputTokens: parseInt(process.env.LLM_MAX_TOKENS || '300', 10),
      topP: parseFloat(process.env.LLM_TOP_P || '0.9'),
      topK: parseInt(process.env.LLM_TOP_K || '40', 10),
    };

    if (!this.gemini.model.startsWith('gemini')) {
      // Forzamos un modelo válido si vino algo legacy
      this.gemini.model = 'gemini-1.5-flash-latest';
    }

    if (!this.gemini.apiKey) {
      console.warn('[ChatService] GEMINI_API_KEY no está configurado. Se usará fallback simulado.');
    } else {
      console.log('[ChatService] Gemini activado con modelo:', this.gemini.model);
    }
  }

  /**
   * Llama a Gemini con prompt + contexto (opcional)
   */
  async callGemini(prompt, context = null) {
    // Construir prompt con contexto
    let fullPrompt = prompt;
    if (context) {
      fullPrompt = `Contexto: ${JSON.stringify(context)}\n\nUsuario: ${prompt}`;
    }

    // URL y body según API v1 de Gemini
    const url = `${this.gemini.baseURL}/models/${this.gemini.model}:generateContent?key=${this.gemini.apiKey}`;
    const body = {
      contents: [{ parts: [{ text: fullPrompt }]}],
      generationConfig: {
        temperature: this.gemini.temperature,
        maxOutputTokens: this.gemini.maxOutputTokens,
        topP: this.gemini.topP,
        topK: this.gemini.topK,
      },
    };

    // 🔎 Logs útiles para diagnosticar 401/403/404
    console.log('Gemini URL  ->', url);
    console.log('Gemini base ->', this.gemini.baseURL);
    console.log('Gemini model->', this.gemini.model);

    try {
      const res = await axios.post(url, body, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
      });

      const text = res?.data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
      return text ? this.cleanResponse(text) : this.getFallbackResponse();
    } catch (error) {
      const status = error?.response?.status;
      console.error('Error llamando a Gemini:', status || '', error.message);
      if (status === 401 || status === 403) {
        console.warn('Gemini: API key inválida o API no habilitada. Usando respuesta simulada.');
      }
      if (status === 404) {
        console.warn('Gemini: modelo/endpoint no encontrado. Verifica LLM_BASE_URL y LLM_MODEL.');
      }
      return this.getFallbackResponse();
    }
  }

  cleanResponse(text) {
    return String(text)
      .replace(/^.*Usuario:.*?\n\n?/i, '')
      .replace(/^.*Contexto:.*?\n\n?/i, '')
      .trim();
  }

  getFallbackResponse() {
    const responses = [
      'Entiendo tu consulta. ¿En qué más puedo ayudarte?',
      'Gracias por tu mensaje. Si me das un poco más de detalle, puedo ayudarte mejor.',
      'He procesado tu solicitud. ¿Necesitas información adicional?',
      'Comprendo lo que necesitas. Permíteme ayudarte con eso.',
      'Recibido tu mensaje. Estoy preparando una respuesta para ti.',
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // ---------- API pública del servicio ----------
  async processMessage(message, context = null) {
    console.log('Procesando mensaje:', { message, context });
    const response = await this.callGemini(message, context);
    return {
      text: response,
      processed_at: new Date().toISOString(),
      model_used: this.gemini.model,
      provider: 'gemini',
    };
  }

  async handleEventOne(message, context = null) {
    console.log('Manejando evento uno:', { message, context });
    const enhancedPrompt = `[EVENTO_UNO] ${message}`;
    const enhancedContext = { ...context, event_type: 'evento_uno', processing_mode: 'primary_block' };
    const response = await this.callGemini(enhancedPrompt, enhancedContext);
    return {
      text: response,
      event_type: 'evento_uno',
      processed_at: new Date().toISOString(),
      model_used: this.gemini.model,
      provider: 'gemini',
    };
  }

  async handleEventTwo(message, context = null) {
    console.log('Manejando evento dos:', { message, context });
    const enhancedPrompt = `[EVENTO_DOS] ${message}`;
    const enhancedContext = { ...context, event_type: 'evento_dos', processing_mode: 'secondary_block' };
    const response = await this.callGemini(enhancedPrompt, enhancedContext);
    return {
      text: response,
      event_type: 'evento_dos',
      processed_at: new Date().toISOString(),
      model_used: this.gemini.model,
      provider: 'gemini',
    };
  }
}

// Instancia única
const chatService = new ChatService();

module.exports = {
  processMessage: (message, context) => chatService.processMessage(message, context),
  handleEventOne: (message, context) => chatService.handleEventOne(message, context),
  handleEventTwo: (message, context) => chatService.handleEventTwo(message, context),
};
