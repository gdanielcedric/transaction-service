import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { Transaction, TransactionStatus } from './entities/transaction.entity';

@Injectable()
export class TransactionService {
  private cache = new Map<string, Transaction>();

  constructor(private readonly configService: ConfigService) {}

  async createTransaction(id: string): Promise<Transaction> {
    // Vérifier les doublons
    if (this.cache.has(id)) {
      throw new HttpException('Duplicate request', HttpStatus.CONFLICT);
    }

    const transaction = new Transaction(id);
    this.cache.set(id, transaction);

    const webhookUrl = this.configService.get<string>('WEBHOOK_URL');
    const thirdPartyApiUrl = this.configService.get<string>('THIRD_PARTY_API_URL');
    const statusApiUrl = `${thirdPartyApiUrl}/${id}`;
    const timeOut = this.configService.get<number>('TIME_OUT') || 5000;
    const maxWaitTime = this.configService.get<number>('MAX_WAIT_TIME') || 120000;

    try {
      // Essayer d'appeler le service tiers
      const response = await Promise.race([
        axios.post(thirdPartyApiUrl, { id, webhookUrl }),
        this.timeout(timeOut), // Timeout de 5s
      ]);

      // Si une réponse immédiate est disponible
      if (response) {
        const status = response.data.status; // completed | declined
        transaction.status = status === 'completed' ? TransactionStatus.COMPLETED : TransactionStatus.DECLINED;
        return transaction;
      }
    } catch (error) {
      console.error('Third-party API call (',thirdPartyApiUrl,') failed or timed out:', error.message);

      // Si le service retourne une erreur 504, on planifie une vérification
      if (error.response?.status === 504) {
        this.scheduleStatusCheck(id, statusApiUrl, maxWaitTime); // Planifie des vérifications jusqu'à 120 secondes
      }
    }

    // Retourner "pending" immédiatement
    transaction.status = TransactionStatus.PENDING;
    return transaction;
  }

  private async notifClt(id: string, etat: string) {
    const cltUrl = this.configService.get<string>('CLIENT_URL');
    const objet = {
      status : {
        id : id,
        status : etat
      }
    };

    try {
      await axios.put(cltUrl, objet);
    } catch (error) {
      console.error(`Status update failed for transaction ${id}:`, error.message);
    }
  }

  private async scheduleStatusCheck(id: string, statusApiUrl: string, maxWaitTime: number) {
    let retryCount = 0;
    const retryInterval = this.configService.get<number>('INTERVAL') || 5000;

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
        const status = response.data.status; // completed | declined

        transaction.status = status === 'completed' ? TransactionStatus.COMPLETED : TransactionStatus.DECLINED;
        this.cache.set(id, transaction);
        //
        this.notifClt(id, status);

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
    console.error('appel du webhook id: ', id, ' status: ', status);
    const transaction = this.cache.get(id);

    if (transaction && transaction.status === TransactionStatus.PENDING) {
      transaction.status =
        status === 'completed'
          ? TransactionStatus.COMPLETED
          : TransactionStatus.DECLINED;
      this.cache.set(id, transaction);
      //
      this.notifClt(id, transaction.status);
    }
  }
}