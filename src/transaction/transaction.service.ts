import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { Transaction, TransactionStatus } from './entities/transaction.entity';

@Injectable()
export class TransactionService {
  private cache = new Map<string, Transaction>();

  constructor(private readonly configService: ConfigService) {}

  async createTransaction(id: string): Promise<string> {
    // Vérifier les doublons
    if (this.cache.has(id)) {
      throw new HttpException('Duplicate request', HttpStatus.CONFLICT);
    }

    const transaction = new Transaction(id);
    this.cache.set(id, transaction);

    const webhookUrl = `${this.configService.get<string>('WEBHOOK_URL')}/${id}`;
    const thirdPartyApiUrl = this.configService.get<string>('THIRD_PARTY_API_URL');
    const statusApiUrl = `${thirdPartyApiUrl}/${id}`;

    try {
      // Essayer d'appeler le service tiers
      const response = await Promise.race([
        axios.post(thirdPartyApiUrl, { id, webhookUrl }),
        this.timeout(5000), // Timeout de 5s
      ]);

      // Si une réponse immédiate est disponible
      if (response) {
        const status = response.data.status; // Supposons completed | declined
        transaction.status =
          status === 'completed' ? TransactionStatus.COMPLETED : TransactionStatus.DECLINED;
        return status === 'completed' ? 'accepted' : 'declined';
      }
    } catch (error) {
      console.error('Third-party API call failed or timed out:', error.message);

      // Si le service retourne une erreur 504, on planifie une vérification
      if (error.response?.status === 504) {
        this.scheduleStatusCheck(id, statusApiUrl, 120000); // Planifie des vérifications jusqu'à 120 secondes
      }
    }

    // Retourner "pending" immédiatement
    return 'pending';
  }

  private async scheduleStatusCheck(id: string, statusApiUrl: string, maxWaitTime: number) {
    let retryCount = 0;
    const retryInterval = 10000; // Intervalle de vérification : 10 secondes

    while (retryCount * retryInterval < maxWaitTime) {
      retryCount++;
      await this.delay(retryInterval);

      const transaction = this.cache.get(id);
      if (!transaction || transaction.status !== TransactionStatus.PENDING) {
        // Si le statut est déjà mis à jour via le webhook ou une autre vérification
        return;
      }

      try {
        const response = await axios.get(statusApiUrl);
        const status = response.data.status; // Supposons completed | declined

        transaction.status =
          status === 'completed' ? TransactionStatus.COMPLETED : TransactionStatus.DECLINED;
        this.cache.set(id, transaction);

        console.log(`Transaction ${id} updated to ${transaction.status}`);
        return; // Arrêter après une mise à jour réussie
      } catch (error) {
        console.error(`Status check failed for transaction ${id}:`, error.message);
        if (error.response?.status === 429) {
          // Arrêter si le service tiers bloque nos appels
          console.warn(`Too many requests for transaction ${id}. Stopping further checks.`);
          return;
        }
      }
    }

    console.warn(`Transaction ${id} could not be confirmed after ${maxWaitTime / 1000}s.`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private timeout(ms: number): Promise<null> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout exceeded')), ms),
    );
  }

  updateTransactionStatus(id: string, status: string): void {
    const transaction = this.cache.get(id);

    if (transaction) {
      transaction.status =
        status === 'completed'
          ? TransactionStatus.COMPLETED
          : TransactionStatus.DECLINED;
      this.cache.set(id, transaction);
    }
  }
}