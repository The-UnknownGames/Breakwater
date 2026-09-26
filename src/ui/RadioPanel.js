// Radio log (spec 9): the last three messages, bottom right, fading out.

export class RadioPanel {
  constructor(parent) {
    this.root = document.createElement('div');
    this.root.className = 'radio-log';
    parent.appendChild(this.root);
    this.items = [];
  }

  push(m) {
    const el = document.createElement('div');
    el.className = `radio-msg ${m.kind}`;
    el.textContent = m.text;
    this.root.appendChild(el);
    this.items.push({ el, age: 0 });
    while (this.items.length > 3) {
      this.items.shift().el.remove();
    }
  }

  update(dt) {
    for (const it of this.items) {
      it.age += dt;
      it.el.style.opacity = String(Math.max(0, Math.min(1, (40 - it.age) / 6)));
    }
    this.items = this.items.filter((it) => {
      if (it.age > 40) {
        it.el.remove();
        return false;
      }
      return true;
    });
  }
}
