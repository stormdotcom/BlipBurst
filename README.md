````markdown
# BlipBurst

**BlipBurst** is a lightweight TypeScript library to simulate controlled bursts of network errors during API calls. Useful for testing error handling, retries, and resilience in both frontend (React, Vue, Angular) and backend (Node.js) environments.

---

## Features

- Simulate errors either all at once or at a configurable frequency.
- Define custom error windows with start and end times.
- Works seamlessly in Node.js (with `node-fetch`) and browsers (native `fetch`).
- Fully typed with TypeScript.

---

## Installation

```bash
npm install blipburst
# or
yarn add blipburst
````

For Node.js environments, install peer dependency:

```bash
npm install node-fetch@2
npm install --save-dev @types/node-fetch@2
```

---

## Usage

### Basic example (Node.js or browser)

```ts
import { BlipBurst } from 'blipburst';

const sim = new BlipBurst({
  startDate: '2025-05-15T00:00:00Z',
  endDate: '2025-05-15T23:59:59Z',
  frequency: 3, // 3 errors per minute
  total: 10,
});

async function test() {
  try {
    const data = await sim.makeRequest();
    console.log('Success:', data);
  } catch (error) {
    console.error('Error caught:', error.message);
  }
}

test();
```

---

### React usage example

```tsx
import React, { useEffect, useState } from 'react';
import { BlipBurst } from 'blipburst';

export default function BlipBurstDemo() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const blip = React.useMemo(() => new BlipBurst({
    startDate: new Date(),
    endDate: new Date(Date.now() + 3600000), // 1 hour window
    frequency: 1, // 1 error per minute
    total: 5,
  }), []);

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      try {
        const res = await blip.makeRequest();
        if (active) {
          setData(res);
          setError(null);
        }
      } catch (e) {
        if (active) setError(e.message);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 20000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [blip]);

  return (
    <div>
      <h1>BlipBurst React Demo</h1>
      {error ? <p style={{ color: 'red' }}>{error}</p> : <pre>{JSON.stringify(data, null, 2)}</pre>}
    </div>
  );
}
```

---

## API

### `new BlipBurst(options)`

| Option      | Type             | Description                                   | Default                                          |
| ----------- | ---------------- | --------------------------------------------- | ------------------------------------------------ |
| `startDate` | `Date \| string` | Start time for error simulation window        | Current time (`new Date()`)                      |
| `endDate`   | `Date \| string` | End time for error simulation window          | 4 days after startDate                           |
| `frequency` | `number`         | Errors per minute (0 means throw all at once) | `1 / (24 * 60)` (1 error/day)                    |
| `total`     | `number`         | Total errors to throw during the window       | 4                                                |
| `url`       | `string`         | URL to send requests to                       | `'https://jsonplaceholder.typicode.com/posts/1'` |

### `.makeRequest()`

Makes a network request to the configured URL.

* Throws a simulated error based on frequency and time window.
* Returns response JSON when no error is simulated.

---

## License

MIT © Ajmal N

```
```
