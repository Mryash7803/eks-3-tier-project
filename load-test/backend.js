import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 100,
  duration: '3m',
};

export default function () {
  const res = http.get('http://backend:8080/api/tasks');

  check(res, {
    'status is 200': (r) => r.status === 200,
  });
}
