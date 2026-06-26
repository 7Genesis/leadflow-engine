import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { LeadsModule } from './leads/leads.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    BullModule.forRoot({
      redis: {
        host: 'localhost',
        port: 6379,
      },
    }),
    LeadsModule,
    PrismaModule,
  ],
})
export class AppModule {}