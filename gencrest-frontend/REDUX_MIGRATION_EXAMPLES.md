# Redux Migration Examples

## Quick Reference Guide

### 1. Using Auth State

#### Old Way (Context API)
```tsx
import { useAuth } from './contexts/AuthContext';

const MyComponent = () => {
  const { user, isAuthenticated, login, logout } = useAuth();

  return <div>{user?.name}</div>;
};
```

#### New Way (Redux)
```tsx
import { useAppSelector, useAppDispatch } from './store/hooks';
import { setUser, logout } from './store/slices/authSlice';

const MyComponent = () => {
  const user = useAppSelector(state => state.auth.user);
  const isAuthenticated = useAppSelector(state => state.auth.isAuthenticated);
  const dispatch = useAppDispatch();

  const handleLogin = (userData) => {
    dispatch(setUser(userData));
  };

  const handleLogout = () => {
    dispatch(logout());
  };

  return <div>{user?.name}</div>;
};
```

### 2. Loading States

#### Old Way
```tsx
import { useLoader } from './contexts/LoaderContext';

const MyComponent = () => {
  const { isLoading, setIsLoading } = useLoader();

  const fetchData = async () => {
    setIsLoading(true);
    await api.getData();
    setIsLoading(false);
  };
};
```

#### New Way
```tsx
import { useAppSelector, useAppDispatch } from './store/hooks';
import { setLoading } from './store/slices/uiSlice';

const MyComponent = () => {
  const isLoading = useAppSelector(state => state.ui.isLoading);
  const dispatch = useAppDispatch();

  const fetchData = async () => {
    dispatch(setLoading(true));
    await api.getData();
    dispatch(setLoading(false));
  };
};
```

### 3. Modal Management

#### Old Way
```tsx
import { useModal } from './contexts/ModalContext';

const MyComponent = () => {
  const { openModal, closeModal, modalType } = useModal();

  const handleOpen = () => {
    openModal('verify-stock', { id: 123 });
  };
};
```

#### New Way
```tsx
import { useAppSelector, useAppDispatch } from './store/hooks';
import { openModal, closeModal } from './store/slices/uiSlice';

const MyComponent = () => {
  const { isOpen, type, data } = useAppSelector(state => state.ui.modal);
  const dispatch = useAppDispatch();

  const handleOpen = () => {
    dispatch(openModal({ type: 'verify-stock', data: { id: 123 } }));
  };

  const handleClose = () => {
    dispatch(closeModal());
  };
};
```

### 4. Data Caching

#### New Feature (Redux Persist)
```tsx
import { useAppSelector, useAppDispatch } from './store/hooks';
import { setCachedData } from './store/slices/dataSlice';

const MyComponent = () => {
  const dispatch = useAppDispatch();
  const cachedDistributors = useAppSelector(
    state => state.data.cache['distributors']
  );

  const fetchDistributors = async () => {
    // Check cache first
    if (cachedDistributors) {
      const age = Date.now() - cachedDistributors.timestamp;
      if (age < cachedDistributors.expiresIn) {
        // Use cached data
        return cachedDistributors.data;
      }
    }

    // Fetch fresh data
    const data = await api.getDistributors();

    // Cache it (5 minutes)
    dispatch(setCachedData({
      key: 'distributors',
      data,
      expiresIn: 300000
    }));

    return data;
  };
};
```

### 5. Liquidation State

#### New Way
```tsx
import { useAppSelector, useAppDispatch } from './store/hooks';
import { setEntries, setSelectedEntry, setFilters } from './store/slices/liquidationSlice';

const LiquidationComponent = () => {
  const entries = useAppSelector(state => state.liquidation.entries);
  const selectedEntry = useAppSelector(state => state.liquidation.selectedEntry);
  const filters = useAppSelector(state => state.liquidation.filters);
  const dispatch = useAppDispatch();

  // Set entries
  const loadEntries = (data) => {
    dispatch(setEntries(data));
  };

  // Select entry
  const selectEntry = (entry) => {
    dispatch(setSelectedEntry(entry));
  };

  // Update filters
  const updateSearch = (searchTerm) => {
    dispatch(setFilters({ search: searchTerm }));
  };
};
```

### 6. Toast Notifications (New Feature)

```tsx
import { useAppDispatch } from './store/hooks';
import { showToast } from './store/slices/uiSlice';

const MyComponent = () => {
  const dispatch = useAppDispatch();

  const handleSuccess = () => {
    dispatch(showToast({
      message: 'Operation completed successfully!',
      type: 'success'
    }));

    // Auto-hide after 3 seconds
    setTimeout(() => {
      dispatch(hideToast());
    }, 3000);
  };

  const handleError = (error) => {
    dispatch(showToast({
      message: error.message,
      type: 'error'
    }));
  };
};
```

### 7. Using Page Transitions

```tsx
import PageTransition from './components/ui/PageTransition';

const MyPage = () => {
  return (
    <PageTransition>
      <div className="p-6">
        <h1>My Page Content</h1>
        {/* Page content */}
      </div>
    </PageTransition>
  );
};
```

### 8. Using Spinners

```tsx
import Spinner from './components/ui/Spinner';

const MyComponent = () => {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <div>
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner size="lg" color="border-orange-500" />
        </div>
      ) : (
        <Content />
      )}
    </div>
  );
};
```

### 9. Using Skeleton Loaders

```tsx
import { LoadingSkeleton } from './components/LoadingSkeleton';

const MyList = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState([]);

  if (isLoading) {
    return <LoadingSkeleton type="card" count={3} />;
  }

  return (
    <div>
      {data.map(item => <ItemCard key={item.id} item={item} />)}
    </div>
  );
};
```

### 10. Offline Support

```tsx
import { useAppSelector, useAppDispatch } from './store/hooks';
import { addPendingSync, setOnlineStatus } from './store/slices/dataSlice';

const MyComponent = () => {
  const isOnline = useAppSelector(state => state.data.isOnline);
  const pendingSync = useAppSelector(state => state.data.pendingSync);
  const dispatch = useAppDispatch();

  useEffect(() => {
    const handleOnline = () => dispatch(setOnlineStatus(true));
    const handleOffline = () => dispatch(setOnlineStatus(false));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [dispatch]);

  const saveData = async (data) => {
    if (!isOnline) {
      // Queue for later
      dispatch(addPendingSync({
        id: Date.now().toString(),
        action: 'save',
        data
      }));
      return;
    }

    // Save immediately
    await api.save(data);
  };

  return (
    <div>
      {!isOnline && (
        <div className="bg-yellow-100 text-yellow-800 p-2 text-center">
          Offline - Changes will sync when connection is restored
          {pendingSync.length > 0 && ` (${pendingSync.length} pending)`}
        </div>
      )}
      {/* Content */}
    </div>
  );
};
```

## Benefits of Redux Migration

1. **Single Source of Truth**: All state in one place
2. **Predictable State**: State changes are explicit
3. **DevTools**: Time-travel debugging
4. **Persistence**: State survives page reloads
5. **Performance**: Optimized re-renders
6. **Type Safety**: Full TypeScript support
7. **Middleware**: Easy to add analytics, logging, etc.

## Next Steps

1. Gradually replace Context usage with Redux
2. Add more slices as needed (e.g., reportsSlice, approvalsSlice)
3. Implement selectors for complex state derivations
4. Add Redux middleware for API calls (RTK Query)
5. Set up Redux DevTools extension

## Common Patterns

### Creating a New Slice

```tsx
// src/store/slices/myFeatureSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface MyFeatureState {
  data: any[];
  loading: boolean;
  error: string | null;
}

const initialState: MyFeatureState = {
  data: [],
  loading: false,
  error: null,
};

const myFeatureSlice = createSlice({
  name: 'myFeature',
  initialState,
  reducers: {
    setData: (state, action: PayloadAction<any[]>) => {
      state.data = action.payload;
      state.loading = false;
      state.error = null;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.loading = false;
    },
  },
});

export const { setData, setLoading, setError } = myFeatureSlice.actions;
export default myFeatureSlice.reducer;
```

### Adding to Store

```tsx
// src/store/index.ts
import myFeatureReducer from './slices/myFeatureSlice';

const rootReducer = combineReducers({
  // ... existing reducers
  myFeature: myFeatureReducer,
});
```

## Troubleshooting

### State Not Persisting
- Check `whitelist` in persist config
- Verify localStorage is available
- Check browser console for errors

### Type Errors
- Use `useAppSelector` and `useAppDispatch` hooks
- Ensure proper RootState and AppDispatch types

### Slow Performance
- Use selectors with memoization
- Consider splitting large slices
- Check for unnecessary re-renders

## Resources

- [Redux Toolkit Docs](https://redux-toolkit.js.org/)
- [Redux Persist Docs](https://github.com/rt2zz/redux-persist)
- [React-Redux Hooks](https://react-redux.js.org/api/hooks)
