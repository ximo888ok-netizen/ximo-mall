const { PrismaClient, LearningStatus } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

// Import the provider service
async function getProviderAdapter() {
  const provider = await prisma.providerConfig.findFirst({
    where: { isActive: true },
    include: { models: true },
  });

  if (!provider) {
    throw new Error("No active provider config found.");
  }

  // Simple decrypt (assuming it's stored encrypted)
  const apiKey = provider.apiKeyEncrypted; // May need decryption
  
  return {
    provider,
    apiKey,
    baseUrl: provider.baseUrl
  };
}

async function testLearning() {
  console.log('=== Testing Learning Flow ===\n');
  
  // 1. Get active provider
  const { provider, apiKey, baseUrl } = await getProviderAdapter();
  console.log('Provider:', provider.name);
  console.log('BaseURL:', baseUrl);
  console.log('API Key (masked):', apiKey ? apiKey.substring(0, 10) + '...' : 'N/A');
  
  // 2. Find vision models
  const visionModels = provider.models.filter(m => {
    const caps = m.capabilities || {};
    return caps.vision === true && caps.text === true;
  });
  
  console.log('\n=== Vision Models ===');
  console.log('Found:', visionModels.length, 'vision models');
  
  if (visionModels.length === 0) {
    console.log('ERROR: No vision models found!');
    console.log('\nAll models capabilities:');
    for (const m of provider.models.slice(0, 10)) {
      console.log('  ', m.modelId, JSON.stringify(m.capabilities));
    }
    await prisma.$disconnect();
    return;
  }
  
  // 3. Select best vision model
  const preferred = 
    visionModels.find(m => m.isDefaultAnalysis)?.modelId ||
    visionModels.find(m => /gemini|gpt-4o|qwen-vl|doubao-vision/i.test(m.modelId))?.modelId ||
    visionModels[0]?.modelId;
    
  console.log('Selected model:', preferred);
  
  // 4. Read a test image
  const testImagePath = path.join('F:\\banana-mall-main\\storage', 'learning\\cmpgfx29w0000q3e4gtduud1q\\1779425370871-KKQU0z.jpg');
  const imageBuffer = fs.readFileSync(testImagePath);
  const base64Image = imageBuffer.toString('base64');
  console.log('\nTest image loaded:', base64Image.length, 'bytes (base64)');
  
  // 5. Test API call
  console.log('\n=== Testing API Call ===');
  
  const OpenAI = require('openai').default;
  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: baseUrl,
  });
  
  try {
    const response = await client.chat.completions.create({
      model: preferred,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this image briefly.' },
            { 
              type: 'image_url', 
              image_url: { 
                url: `data:image/jpeg;base64,${base64Image}` 
              } 
            }
          ]
        }
      ],
      max_tokens: 100
    });
    
    console.log('SUCCESS! Response:', response.choices[0]?.message?.content?.substring(0, 200));
  } catch (error) {
    console.log('ERROR:', error.message);
    if (error.response) {
      console.log('Response data:', error.response.data);
    }
  }
  
  await prisma.$disconnect();
}

testLearning().catch(e => { console.error(e); process.exit(1); });
