const { ChatOpenAI } = require('@langchain/openai');
const { PromptTemplate } = require('@langchain/core/prompts');
const { StructuredOutputParser } = require('@langchain/core/output_parsers');
const { z } = require('zod');

// 1. Define the Zod schema
const grievanceSchema = z.object({
  category: z.enum([
    'IT Support',
    'Facilities',
    'Human Resources',
    'Finance & Billing',
    'Academic / Coursework',
    'General Inquiry'
  ]).describe('The category that best fits the grievance'),
  urgency: z.enum(['Low', 'Medium', 'High', 'Critical']).describe('The priority level based on severity')
});

// 2. Instantiate the parser
const parser = StructuredOutputParser.fromZodSchema(grievanceSchema);

// 3. Define the LLM Prompt Template
const prompt = new PromptTemplate({
  template: `You are an automated complaint classification assistant. Analyze the following grievance description and extract the category and urgency level.

  Format Instructions:
  {format_instructions}

  Grievance Description:
  {description}`,
  inputVariables: ['description'],
  partialVariables: { format_instructions: parser.getFormatInstructions() }
});

// Helper for local keyword-based classification fallback
const classifyLocally = (description) => {
  const desc = description.toLowerCase();
  
  // Category heuristic classification
  let category = 'General Inquiry';
  if (/\b(laptop|computer|software|email|login|server|wifi|internet|password|printer|screen|keyboard|mouse|bug|crash|access|it support|database|system|network|vpn|slack|hardware)\b/.test(desc)) {
    category = 'IT Support';
  } else if (/\b(leak|water|toilet|desk|chair|light|bulb|room|door|lock|window|air cond|ac|heating|vent|floor|cleaning|trash|power outlet|ac |electric|pipe|plumbing|elevator|roof|building)\b/.test(desc)) {
    category = 'Facilities';
  } else if (/\b(hr|human resources|salary|pay|holiday|leave|harassment|behavior|manager|contract|job|interview|onboard|insurance|benefits|payroll|compensation|recruitment|employer|employee)\b/.test(desc)) {
    category = 'Human Resources';
  } else if (/\b(invoice|bill|fee|charge|payment|refund|finance|billing|card|bank|cost|price|transaction|receipt|tax|tuition|bursar)\b/.test(desc)) {
    category = 'Finance & Billing';
  } else if (/\b(course|exam|grade|lecture|assignment|professor|teacher|syllabus|class|student|study|academic|curriculum|major|minor|transcript|registration)\b/.test(desc)) {
    category = 'Academic / Coursework';
  }

  // Urgency heuristic classification
  let urgency = 'Low';
  if (/\b(fire|danger|injury|hack|breach|leak|emergency|security threat|server down|system offline|fatal|hospital|unsafe|broken bone|bleeding)\b/.test(desc)) {
    urgency = 'Critical';
  } else if (/\b(not working|cannot login|blocked|stolen|broken|urgent|asap|payment failed|disabled|down|broken|fail|error|crash|prevent|stop)\b/.test(desc)) {
    urgency = 'High';
  } else if (/\b(need help|request|slow|minor|question|update|delayed|ticket|help|issue|bug|problem)\b/.test(desc)) {
    urgency = 'Medium';
  }

  return { category, urgency };
};

// 4. Create the main classification function
const classifyGrievance = async (description) => {
  const apiKey = process.env.OPENAI_API_KEY;
  
  // If OpenAI API key is missing or set to the default placeholder, fallback immediately
  if (!apiKey || apiKey === 'your_openai_api_key_here') {
    console.log('AI Tagger: Using local keyword-based classification (No valid OpenAI API key).');
    return classifyLocally(description);
  }

  try {
    // Initialize LLM Model dynamically
    const model = new ChatOpenAI({
      modelName: 'gpt-4o-mini',
      temperature: 0,
      openAIApiKey: apiKey
    });

    const input = await prompt.format({ description });
    const response = await model.invoke(input);
    const parsedResult = await parser.parse(response.content);
    return parsedResult;
  } catch (error) {
    console.error('LLM Auto-tagging Error, falling back to local classifier:', error.message);
    return classifyLocally(description);
  }
};

module.exports = {
  categorizeGrievance: classifyGrievance, // Maintain support for legacy names
  classifyGrievance
};