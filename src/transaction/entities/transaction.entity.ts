export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'accepted',
  DECLINED = 'declined',
}

export class Transaction {
  id: string;
  status: TransactionStatus;
  // createdAt: Date;

  constructor(id: string) {
    this.id = id;
    this.status = TransactionStatus.PENDING;
    // this.createdAt = new Date();
  }
}