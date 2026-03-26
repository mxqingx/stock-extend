import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { MobileBottomNav } from './MobileBottomNav';
import styles from './MobileLayout.module.css';

export function MobileLayout() {
  return (
    <div className={styles.mobileLayout}>
      <Header />
      <main className={styles.main}>
        <div className={styles.content}>
          <Outlet />
        </div>
      </main>
      <MobileBottomNav />
    </div>
  );
}

export default MobileLayout;
