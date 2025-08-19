import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../apps/hr-api/src/app.module';
import * as fs from 'fs';
import * as path from 'path';

async function generateOpenAPI() {
  const app = await NestFactory.create(AppModule, { logger: false });
  
  const config = new DocumentBuilder()
    .setTitle('Hunters Run API')
    .setDescription('Maintenance management API with RLS and audit chain')
    .setVersion('1.0')
    .addTag('lookups', 'Reference data lookups')
    .addTag('maintenance', 'Work order management')
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-org-id',
        in: 'header',
        description: 'Organization ID for multi-tenant access',
      },
      'x-org-id',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  
  // Ensure output directory exists
  const outputPath = path.join(__dirname, '..', 'apps', 'hr-api', 'openapi.json');
  const outputDir = path.dirname(outputPath);
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Write OpenAPI spec
  fs.writeFileSync(outputPath, JSON.stringify(document, null, 2));
  
  console.log(`✅ OpenAPI spec generated: ${outputPath}`);
  
  await app.close();
}

generateOpenAPI()
  .catch((error) => {
    console.error('❌ Failed to generate OpenAPI spec:', error);
    process.exit(1);
  });