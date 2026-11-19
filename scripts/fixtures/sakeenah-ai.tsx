import React from 'react';
import {createRoot} from 'react-dom/client';
import '../../src/index.css';
import {useDarkRims} from '../../src/theme/useDarkRims';
import SakeenahAIScreen from '../../src/components/SakeenahAIScreen';
import SharedSakeenahConversationPage from '../../src/components/SharedSakeenahConversationPage';
function Fixture() { useDarkRims(); return location.search.includes('shared') ? <SharedSakeenahConversationPage token={'x'.repeat(32)}/> : <SakeenahAIScreen user={{id:'test-user',user_metadata:{name:'Test'}} as any} onBack={()=>{}} />; }
createRoot(document.getElementById('root')!).render(<Fixture/>);
