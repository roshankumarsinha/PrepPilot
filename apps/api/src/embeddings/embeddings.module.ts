import { Global, Module } from '@nestjs/common';
import { EMBEDDING_PROVIDER } from './embedding.provider';
import { OllamaEmbeddingProvider } from './ollama-embedding.provider';

@Global()
@Module({
  providers: [{ provide: EMBEDDING_PROVIDER, useClass: OllamaEmbeddingProvider }],
  exports: [EMBEDDING_PROVIDER],
})
export class EmbeddingsModule {}
