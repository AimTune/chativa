import type { BaseMessage, ChatAdapter } from "../chat-core/adapter";

export class DummyAdapter implements ChatAdapter {
  private onMsg: ((msg: BaseMessage) => void) | null = null;

  sendMessage(message: BaseMessage): void {
    // Kullanıcı mesajını aldıktan sonra sabit cevap gönder
    setTimeout(() => {
      this.onMsg &&
        this.onMsg({
          id: Date.now().toString(),
          type: "text",
          data: {
            text: `Merhaba, bu sabit bir cevaptır! önceki mesaj ${message.data.text}`,
          },
        });
      this.onMsg &&
        this.onMsg({
          id: Date.now().toString(),
          type: "text",
          data: { text: "Merhaba, bu sabit bir cevaptır2!" },
        });
    }, 500);
  }

  onMessage(callback: (msg: any) => void): void {
    this.onMsg = callback;
  }
}
