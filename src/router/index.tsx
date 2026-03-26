/**
 * 路由配置
 */

import { Suspense, lazy } from 'react';
import { createBrowserRouter, createHashRouter, RouterProvider } from 'react-router-dom';
import { Layout } from '@/components/layout';
import { Loading } from '@/components/common';

const Dashboard = lazy(() => import('@/pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Heatmap = lazy(() => import('@/pages/Heatmap').then(m => ({ default: m.Heatmap })));
const Rankings = lazy(() => import('@/pages/Rankings').then(m => ({ default: m.Rankings })));
const Boards = lazy(() => import('@/pages/Boards').then(m => ({ default: m.Boards })));
const BoardDetail = lazy(() => import('@/pages/Boards').then(m => ({ default: m.BoardDetail })));
const Watchlist = lazy(() => import('@/pages/Watchlist').then(m => ({ default: m.Watchlist })));
const Scanner = lazy(() => import('@/pages/Scanner').then(m => ({ default: m.Scanner })));
const Settings = lazy(() => import('@/pages/Settings').then(m => ({ default: m.Settings })));
const StockDetail = lazy(() => import('@/pages/StockDetail').then(m => ({ default: m.StockDetail })));
const EndOfDayPicker = lazy(() => import('@/pages/EndOfDayPicker').then(m => ({ default: m.EndOfDayPicker })));

const createRouter = import.meta.env.VITE_OFFLINE_FILE === '1' ? createHashRouter : createBrowserRouter;

const router = createRouter(
  [
    {
      path: '/',
      element: (
        <Layout />
      ),
      children: [
        {
          index: true,
          element: (
            <Suspense fallback={<Loading fullScreen={false} />}>
              <Dashboard />
            </Suspense>
          ),
        },
        {
          path: 'heatmap',
          element: (
            <Suspense fallback={<Loading fullScreen={false} />}>
              <Heatmap />
            </Suspense>
          ),
        },
        {
          path: 'rankings',
          element: (
            <Suspense fallback={<Loading fullScreen={false} />}>
              <Rankings />
            </Suspense>
          ),
        },
        {
          path: 'boards',
          element: (
            <Suspense fallback={<Loading fullScreen={false} />}>
              <Boards />
            </Suspense>
          ),
        },
        {
          path: 'boards/:type/:code',
          element: (
            <Suspense fallback={<Loading fullScreen={false} />}>
              <BoardDetail />
            </Suspense>
          ),
        },
        {
          path: 'watchlist',
          element: (
            <Suspense fallback={<Loading fullScreen={false} />}>
              <Watchlist />
            </Suspense>
          ),
        },
        {
          path: 'scanner',
          element: (
            <Suspense fallback={<Loading fullScreen={false} />}>
              <Scanner />
            </Suspense>
          ),
        },
        {
          path: 'eod-picker',
          element: (
            <Suspense fallback={<Loading fullScreen={false} />}>
              <EndOfDayPicker />
            </Suspense>
          ),
        },
        {
          path: 'settings',
          element: (
            <Suspense fallback={<Loading fullScreen={false} />}>
              <Settings />
            </Suspense>
          ),
        },
        {
          path: 's/:code',
          element: (
            <Suspense fallback={<Loading fullScreen={false} />}>
              <StockDetail />
            </Suspense>
          ),
        },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL }
);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
