import { UserMap } from "service/type";
import { useEffect } from "react";
import { RootState } from 'store/configureStore';
import { useSelector } from "react-redux";
import { useCallWorker } from "hooks/useWorker";
import { CallRelayType } from "service/worker/type";
import { defaultRelays } from "service/relay";
import { useReadonlyMyPublicKey } from "hooks/useMyPublicKey";
import { deserializeMetadata, Event, EventContactListPTag, EventSetMetadataContent, EventTags, PublicKey, WellKnownEventKind } from 'service/api';
import styles from './index.module.scss';

export interface IMentions {
  key: string,
  value: string,
  label: React.ReactNode
}

export function useLoadContacts(
  setUserMap: React.Dispatch<React.SetStateAction<UserMap>>,
  userContactList: { keys: PublicKey[]; created_at: number },
  setUserContactList: React.Dispatch<React.SetStateAction<{ keys: PublicKey[]; created_at: number }>>
) {
  const myPublicKey = useReadonlyMyPublicKey();
  const { worker, newConn, wsConnectStatus } = useCallWorker();
  const isLoggedIn = useSelector((state: RootState) => state.loginReducer.isLoggedIn);
  
  function handleEvent(event: Event, relayUrl?: string) {
    if (event.kind === WellKnownEventKind.set_metadata) {
      const metadata: EventSetMetadataContent = deserializeMetadata(event.content);
      setUserMap(prev => {
        const newMap = new Map(prev);
        const oldData = newMap.get(event.pubkey);
        if (oldData && oldData.created_at > event.created_at) return newMap;

        newMap.set(event.pubkey, {
          ...metadata,
          ...{ created_at: event.created_at },
        });

        return newMap;
      });
    }

    if (event.kind === WellKnownEventKind.contact_list) {
      if (event.pubkey === myPublicKey) {
        setUserContactList(prev => {
          if (prev && prev?.created_at >= event.created_at) return prev;

          const keys = (
            event.tags.filter(
              t => t[0] === EventTags.P,
            ) as EventContactListPTag[]
          ).map(t => t[1]);

          return {
            keys,
            created_at: event.created_at,
          };
        });
      }
    }
  }

  useEffect(() => {
    const pks = userContactList?.keys || [];

    if (isLoggedIn && myPublicKey.length > 0) pks.push(myPublicKey);
    if (pks.length === 0) return;

    worker
      ?.subMetaDataAndContactList(pks, undefined, undefined, {
        type: CallRelayType.batch,
        data: newConn || Array.from(wsConnectStatus.keys()),
      })
      ?.iterating({ cb: handleEvent });
  }, [newConn, myPublicKey, userContactList?.keys.length]);
}

export function useSetMentions(
  setMentionsValue: React.Dispatch<React.SetStateAction<IMentions[]>>,
  userMap: UserMap
) {
  const myPublicKey = useReadonlyMyPublicKey();

  useEffect(() => {
    setMentionsValue([]);
    const mentions = Array.from(userMap.entries()).filter(u => u[0] !== myPublicKey).reduce((result, [pk, user]) => {
      result.push({
        key: pk,
        value: user.name,
        label: <div className={styles.mentions}>
          <img src={user.picture} alt="picture" />
          <span>{user.name}</span>
        </div>
      });
      return result;
    }, [] as IMentions[]);
    setMentionsValue(mentions);
  }, [userMap]);
}

export function useSetRelays(setRelays: React.Dispatch<React.SetStateAction<string[]>>) {
  const isLoggedIn = useSelector((state: RootState) => state.loginReducer.isLoggedIn);
  const myPublicKey = useReadonlyMyPublicKey();
  const myCustomRelay = useSelector((state: RootState) => state.relayReducer);

  useEffect(() => {
    let relays = defaultRelays;
    if (isLoggedIn === true) {
      relays = relays
        .concat(...(myCustomRelay[myPublicKey] ?? []))
        .filter((item, index, self) => self.indexOf(item) === index);
    }

    relays = relays.filter((elem, index, self) => index === self.indexOf(elem));
    setRelays(relays);
  }, [myPublicKey, myCustomRelay]);
}