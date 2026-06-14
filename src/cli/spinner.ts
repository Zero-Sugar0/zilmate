import chalk from 'chalk';

const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export type ActivitySpinner = {
  update: (label: string, detail?: string) => void;
  stop: (finalLabel?: string) => void;
};

export function createActivitySpinner(initialLabel = 'Working'): ActivitySpinner {
  let frame = 0;
  let label = initialLabel;
  let detail = '';
  let active = true;
  let timer: NodeJS.Timeout | undefined;

  const render = () => {
    if (!active) return;
    const icon = chalk.cyan(frames[frame % frames.length]!);
    frame += 1;
    const suffix = detail ? chalk.gray(` — ${detail.length > 80 ? `${detail.slice(0, 77)}...` : detail}`) : '';
    process.stdout.write(`\r${icon} ${chalk.white(label)}${suffix}   `);
  };

  timer = setInterval(render, 80);
  render();

  return {
    update(nextLabel: string, nextDetail?: string) {
      label = nextLabel;
      detail = nextDetail ?? '';
      render();
    },
    stop(finalLabel?: string) {
      active = false;
      if (timer) clearInterval(timer);
      readlineClear();
      if (finalLabel) {
        console.log(chalk.green(`✓ ${finalLabel}`));
      }
    },
  };
}

function readlineClear() {
  process.stdout.write('\r\x1b[K');
}
