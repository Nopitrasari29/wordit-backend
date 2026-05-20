import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },  // simulate ramp-up of traffic from 1 to 50 users over 30 seconds.
    { duration: '1m', target: 100 }, // stay at 100 users for 1 minute
    { duration: '30s', target: 0 },   // ramp-down to 0 users
  ],
};

const BASE_URL = 'http://localhost:5000';

export default function () {
  // 1. Health check / basic hit
  const res = http.get(`${BASE_URL}/`);
  check(res, {
    'is status 200': (r) => r.status === 200,
  });

  sleep(1);
}
