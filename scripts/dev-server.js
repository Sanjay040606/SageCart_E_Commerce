process.env.NODE_ENV = 'development';

const { startServer } = require('next/dist/server/lib/start-server');

function getFlagValue(names, fallback) {
    const argv = process.argv.slice(2);

    for (let index = 0; index < argv.length; index += 1) {
        const current = argv[index];

        for (const name of names) {
            if (current === name) {
                const nextValue = argv[index + 1];
                if (nextValue && !nextValue.startsWith('-')) {
                    return nextValue;
                }
            }

            if (current.startsWith(`${name}=`)) {
                return current.slice(name.length + 1);
            }
        }
    }

    return fallback;
}

async function main() {
    const portValue = process.env.PORT || getFlagValue(['--port', '-p'], '3000');
    const hostname =
        process.env.HOSTNAME ||
        process.env.HOST ||
        getFlagValue(['--hostname', '-H'], undefined);

    await startServer({
        dir: process.cwd(),
        port: Number(portValue),
        isDev: true,
        hostname,
        allowRetry: true,
    });
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
