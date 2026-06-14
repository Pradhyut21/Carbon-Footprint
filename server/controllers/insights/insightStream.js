import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import logger from '../../utils/logger.js';
import { INSIGHTS_MOCK_TEXT } from '../../constants/config.js';

/**
 * Streams hardcoded fallback insights.
 * @param {import('express').Response} res - Express response
 */
export function streamMockInsights(res) {
  if (process.env.NODE_ENV === 'test') {
    res.write(`data: ${JSON.stringify({ text: INSIGHTS_MOCK_TEXT })}\n\n`);
    res.write('event: done\ndata: [DONE]\n\n');
    return res.end();
  }

  let index = 0;
  const interval = setInterval(() => {
    if (index >= INSIGHTS_MOCK_TEXT.length) {
      res.write('event: done\ndata: [DONE]\n\n');
      res.end();
      return clearInterval(interval);
    }
    res.write(`data: ${JSON.stringify({ text: INSIGHTS_MOCK_TEXT.slice(index, index + 8) })}\n\n`);
    index += 8;
  }, 40);
}

/**
 * Streams Gemini AI responses.
 * @param {import('express').Response} res - Express response
 * @param {Object} dataToSend - Payload data
 * @param {string} systemPrompt - Instruction prompt
 * @param {string} key - Gemini API key
 * @returns {Promise<void>}
 * @throws {Error} If stream execution fails
 */
export async function streamGemini(res, dataToSend, systemPrompt, key) {
  try {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContentStream([
      systemPrompt,
      `Here is my carbon footprint data for the past 30 days as JSON: ${JSON.stringify(dataToSend)}`
    ]);

    for await (const chunk of result.stream) {
      res.write(`data: ${JSON.stringify({ text: chunk.text() })}\n\n`);
    }
    res.write('event: done\ndata: [DONE]\n\n');
  } catch (err) {
    logger.error('Gemini streaming failed:', err.message);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
  } finally {
    res.end();
  }
}

/**
 * Streams Anthropic Claude AI responses.
 * @param {import('express').Response} res - Express response
 * @param {Object} dataToSend - Payload data
 * @param {string} systemPrompt - Instruction prompt
 * @param {string} key - Claude API key
 * @returns {Promise<void>}
 * @throws {Error} If stream execution fails
 */
export async function streamClaude(res, dataToSend, systemPrompt, key) {
  try {
    const modelName = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';
    const anthropic = new Anthropic({ apiKey: key });

    const stream = await anthropic.messages.create({
      model: modelName,
      max_tokens: 500,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Here is my carbon footprint data for the past 30 days as JSON: ${JSON.stringify(dataToSend)}`
      }],
      stream: true
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.text) {
        res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
      }
    }
    res.write('event: done\ndata: [DONE]\n\n');
  } catch (err) {
    logger.error('Claude streaming failed:', err.message);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
  } finally {
    res.end();
  }
}
