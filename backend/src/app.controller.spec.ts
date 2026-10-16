import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaService } from './prisma/prisma.service.js';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: PrismaService, useValue: { $queryRaw: async () => [{ '?column?': 1 }] } },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });

    it('health reports ok when DB pings', async () => {
      await expect(appController.health()).resolves.toMatchObject({ status: 'ok', db: 'up' });
    });

    it('health degrades when DB is down', async () => {
      const mod: TestingModule = await Test.createTestingModule({
        controllers: [AppController],
        providers: [
          AppService,
          {
            provide: PrismaService,
            useValue: {
              $queryRaw: async () => {
                throw new Error('down');
              },
            },
          },
        ],
      }).compile();
      const ctrl = mod.get<AppController>(AppController);
      await expect(ctrl.health()).resolves.toMatchObject({ status: 'degraded', db: 'down' });
    });

    // L4 — liveness never touches the DB: a dead database still yields 200.
    it('live needs no DB', async () => {
      const mod: TestingModule = await Test.createTestingModule({
        controllers: [AppController],
        providers: [
          AppService,
          {
            provide: PrismaService,
            useValue: {
              $queryRaw: async () => {
                throw new Error('down');
              },
            },
          },
        ],
      }).compile();
      const ctrl = mod.get<AppController>(AppController);
      expect(ctrl.live()).toEqual({ status: 'ok' });
    });
  });
});
